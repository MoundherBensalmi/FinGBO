import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ComboboxItem = { id: number; name: string; hint?: string | null | undefined }

type EntityComboboxProps = {
  id: string
  items: ComboboxItem[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder: string
  searchPlaceholder?: string
  /** Shown as the first option to clear the value, e.g. "Aucune personne". */
  noneLabel?: string
  /** Creates a new item from the search text and returns its id. */
  onCreate?: (name: string) => Promise<number>
  createLabel?: (name: string) => string
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** Searchable picker for people and categories, with "create" when nothing matches. */
export function EntityCombobox({
  id,
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Rechercher…',
  noneLabel,
  onCreate,
  createLabel = (name) => `Créer « ${name} »`,
  invalid,
  describedBy,
  disabled,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const selected = items.find((i) => i.id === value)
  const query = search.trim()
  const exactMatch = items.some((i) => normalize(i.name) === normalize(query))

  function close() {
    setOpen(false)
    setSearch('')
  }

  async function create() {
    if (!onCreate || !query) return
    setCreating(true)
    try {
      onChange(await onCreate(query))
      close()
    } catch {
      // the caller shows the error (toast); keep the list open
    } finally {
      setCreating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command
          filter={(itemValue, term) => (normalize(itemValue).includes(normalize(term)) ? 1 : 0)}
        >
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup>
              {noneLabel && !query && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null)
                    close()
                  }}
                >
                  <X className="opacity-60" />
                  <span className="text-muted-foreground">{noneLabel}</span>
                  {value === null && <Check className="ml-auto" />}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.hint ?? ''}#${item.id}`}
                  onSelect={() => {
                    onChange(item.id)
                    close()
                  }}
                >
                  <span className="truncate">{item.name}</span>
                  {item.hint && <span className="text-muted-foreground truncate text-xs">{item.hint}</span>}
                  {item.id === value && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && query && !exactMatch && (
              <CommandGroup forceMount>
                <CommandItem value={`__create__${query}`} onSelect={() => void create()} disabled={creating} forceMount>
                  {creating ? <Loader2 className="animate-spin" /> : <Plus />}
                  {createLabel(query)}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
