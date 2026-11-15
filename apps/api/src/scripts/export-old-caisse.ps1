<#
Exports the old CAISSE desktop app's database to JSON files, for import-old-caisse.ts.

  powershell -ExecutionPolicy Bypass -File export-old-caisse.ps1 -AppDir "C:\...\Caisse2026" -OutDir "C:\...\caisse-export"

Writes Depense.json, Personne.json and TypeDepense.json into -OutDir.

- Works on a copy of systeme\data\mainDB.sdf, so the old app's own file is never opened.
- The database password is read from the old app's settings inside CAISSE.exe; it is not written anywhere.
- Needs "Microsoft SQL Server Compact 3.5", which is installed on every PC that runs the old app.
#>
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [Parameter(Mandatory = $true)][string]$OutDir
)

$ErrorActionPreference = 'Stop'

$exePath = Join-Path $AppDir 'CAISSE.exe'
$sdfPath = Join-Path $AppDir 'systeme\data\mainDB.sdf'
foreach ($path in $exePath, $sdfPath) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Not found: $path" }
}

# SQL Server Compact 3.5 (the folder matching this PowerShell: 64-bit first, then 32-bit).
$dll = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) |
  Where-Object { $_ } |
  ForEach-Object { Join-Path $_ 'Microsoft SQL Server Compact Edition\v3.5\Desktop\System.Data.SqlServerCe.dll' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
if (-not $dll) { throw 'Microsoft SQL Server Compact 3.5 is not installed on this PC.' }
Add-Type -Path $dll

# The connection string is one of the app's settings, stored as plain text in the .exe.
$exeText = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($exePath))
$match = [regex]::Match($exeText, 'mainDB\.sdf;Password=([^;]+);')
if (-not $match.Success) { throw 'Could not find the database settings in CAISSE.exe.' }
$password = $match.Groups[1].Value

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("caisse-export-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workDir | Out-Null
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$invariant = [System.Globalization.CultureInfo]::InvariantCulture

try {
  $copy = Join-Path $workDir 'mainDB.sdf'
  Copy-Item -LiteralPath $sdfPath -Destination $copy

  $connection = New-Object System.Data.SqlServerCe.SqlCeConnection(
    "Data Source=$copy;Password=$password;Mode=Read Only;Temp Path=$workDir")
  $connection.Open()
  try {
    foreach ($table in 'Depense', 'Personne', 'TypeDepense') {
      $command = $connection.CreateCommand()
      $command.CommandText = "SELECT * FROM [$table] ORDER BY [ID]"
      $reader = $command.ExecuteReader()
      $rows = New-Object System.Collections.ArrayList
      while ($reader.Read()) {
        $row = [ordered]@{}
        for ($i = 0; $i -lt $reader.FieldCount; $i++) {
          $value = $reader.GetValue($i)
          if ($value -is [DBNull]) { $value = $null }
          elseif ($value -is [datetime]) { $value = $value.ToString('yyyy-MM-ddTHH:mm:ss', $invariant) }
          # Amounts as text ("1250.5"), so no precision is lost on the way.
          elseif ($value -is [decimal]) { $value = $value.ToString($invariant) }
          $row[$reader.GetName($i)] = $value
        }
        [void]$rows.Add($row)
      }
      $reader.Close()

      $json = ConvertTo-Json -InputObject @($rows) -Depth 3 -Compress
      [System.IO.File]::WriteAllText((Join-Path $OutDir "$table.json"), $json, $utf8)
      Write-Output ("{0}: {1} rows" -f $table, $rows.Count)
    }
  }
  finally {
    $connection.Close()
  }
}
finally {
  Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
