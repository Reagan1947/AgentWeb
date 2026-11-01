/**
 * The shared UI primitives.
 *
 * The rule is that a component earns a place here once a second feature module
 * renders it. Card, Collapsible and Shimmer currently have consumers in the chat
 * module only, and they stay anyway: 16 files across six modules hand-roll their
 * own expand/collapse state today, and moving Collapsible into chat/ would put
 * it behind a module boundary that makes it unreachable to the five modules with
 * the clearest use for it. The two-module rule is a bar for admission, not a
 * trigger for eviction.
 *
 * shadcn/ui primitives (alert-dialog, dropdown-menu, popover, select, sheet,
 * input-group, attachment, and the other files added from the new-york
 * registry) are exported below. The chat composer uses InputGroup and Attachment as the
 * visual shell of its prompt field. Message, Bubble, Message Scroller, Trace,
 * Code Block and Marker are the AI transcript shells, adapted to this app's
 * Tailwind 3 tokens. Button, Dialog, Input, Tooltip and the other PascalCase
 * files stay as the app's existing controls; their props do not match the
 * shadcn equivalents.
 *
 * PromptInput, Reasoning, Queue and Confirmation did move out, on a different
 * test: they are not primitives at all but chat-domain compositions — the
 * composer form, the assistant-reasoning disclosure, the tool todo list and the
 * inline tool-permission request — with chat vocabulary in their prop names and
 * no plausible second consumer. Alert went with Confirmation, which was its only
 * importer and the reason it existed.
 */

export { ActionMenu, ActionMenuButton } from '@/shared/ui/ActionMenu';
export {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from '@/shared/ui/attachment';
export { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from '@/shared/ui/bubble';
export { Badge } from '@/shared/ui/Badge';
export { BrowserIcon } from '@/shared/ui/BrowserIcon';
export { Button, buttonVariants } from '@/shared/ui/Button';
export {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from '@/shared/ui/code-block';
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/shared/ui/Card';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/shared/ui/Collapsible';
export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/shared/ui/Command';
export { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/shared/ui/Dialog';
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/shared/ui/alert-dialog';
export { Marker, MarkerContent, MarkerIcon } from '@/shared/ui/marker';
export {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from '@/shared/ui/message';
export {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/shared/ui/message-scroller';
export { FolderBoldIcon, FolderNotchOpenBoldIcon } from '@/shared/ui/FolderIcons';
export { Input } from '@/shared/ui/Input';
export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from '@/shared/ui/input-group';
export { LLMProviderLogo } from '@/shared/ui/LLMProviderLogo';
export { PillBar, Pill } from '@/shared/ui/PillBar';
export { ScrollArea } from '@/shared/ui/ScrollArea';
export { Shimmer } from '@/shared/ui/Shimmer';
export { Tooltip } from '@/shared/ui/Tooltip';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from '@/shared/ui/dropdown-menu';
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/shared/ui/field';
export { Label } from '@/shared/ui/label';
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from '@/shared/ui/popover';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/shared/ui/select';
export { Separator } from '@/shared/ui/separator';
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/shared/ui/sheet';
export { Skeleton } from '@/shared/ui/skeleton';
export { Checkbox } from '@/shared/ui/checkbox';
export { Switch } from '@/shared/ui/switch';
export { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
export { Textarea } from '@/shared/ui/textarea';
export {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/shared/ui/trace';
