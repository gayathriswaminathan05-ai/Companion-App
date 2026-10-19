import { useMemo, useState } from "react";
import {
  ArrowUpIcon,
  ArrowsClockwiseIcon,
  CaretDownIcon,
  ClockIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Todo } from "../store";
import { parseReminder, parseWhen, formatDue } from "../reminders";
import { GROWTH_LABEL, type GrowthStage } from "../growth";
import MicButton from "./MicButton";
import { GrowthIcon, ListCard, Panel, PanelHeader, SectionLabel } from "@/components/panel";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

// One list. Any task may carry a time; those also ring as reminders.
// Amie / Attio pattern: grouped list, time as a meta line under the title,
// row actions on hover, finished work folded below.
export default function TaskPanel({
  todos,
  growthStage,
  onAdd,
  onActivity,
  onMicPhase,
  onEdit,
  onToggle,
  onDelete,
  onClose,
}: {
  todos: Todo[];
  growthStage: GrowthStage;
  onAdd: (text: string, due?: Date, recurring?: "daily") => void;
  onActivity: () => void;
  onMicPhase: (recording: boolean) => void;
  onEdit: (id: string, text: string, due: Date | null) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [micKey, setMicKey] = useState(0);
  const [micError, setMicError] = useState("");
  const parsed = useMemo(() => parseReminder(text), [text]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editWhen, setEditWhen] = useState("");
  const editDue = useMemo(() => (editWhen.trim() ? parseWhen(editWhen) : null), [editWhen]);

  const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
  const timed = todos
    .filter((t) => !t.done && t.due)
    .sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime());
  const plain = todos.filter((t) => !t.done && !t.due);
  const doneToday = todos.filter((t) => t.done && isToday(t.completedAt));
  const doneOlder = todos.filter((t) => t.done && !isToday(t.completedAt));
  const openCount = timed.length + plain.length;
  const canAdd = Boolean(text.trim());

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (parsed) onAdd(parsed.title, parsed.due, parsed.recurring);
    else onAdd(trimmed);
    setText("");
    setMicKey((k) => k + 1);
  };

  const submitPlain = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(parsed ? parsed.title : trimmed);
    setText("");
    setMicKey((k) => k + 1);
  };

  const startEdit = (t: Todo) => {
    setEditingId(t.id);
    setEditText(t.text);
    setEditWhen(t.due ? formatDue(new Date(t.due)) : "");
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    if (editWhen.trim() && !editDue) return;
    onEdit(editingId, editText.trim(), editWhen.trim() ? editDue : null);
    setEditingId(null);
  };

  const renderList = (list: Todo[]) => (
    <ListCard>
      {list.map((t) =>
        editingId === t.id ? (
          <EditRow
            key={t.id}
            editText={editText}
            setEditText={setEditText}
            editWhen={editWhen}
            setEditWhen={setEditWhen}
            editDue={editDue}
            onSave={saveEdit}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <Row key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} startEdit={startEdit} />
        ),
      )}
    </ListCard>
  );

  return (
    <Panel>
      <PanelHeader title="Today" onClose={onClose}>
        <Badge
          variant="secondary"
          className="bg-success-soft text-success"
          title="Your plant grows when you take care of yourself"
        >
          <GrowthIcon stage={growthStage} />
          {GROWTH_LABEL[growthStage]}
        </Badge>
        {openCount + doneToday.length > 0 && (
          <span className="ml-auto text-xs font-medium text-muted-foreground tabular-nums" title="done today / all of today">
            {doneToday.length}/{openCount + doneToday.length} done
          </span>
        )}
      </PanelHeader>

      <div className="shrink-0 px-3">
        <InputGroup className="h-9 bg-card">
          <InputGroupAddon>
            <PlusIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onActivity();
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a task, like “call amma at 6pm”"
            className="text-[13px]"
          />
          <InputGroupAddon align="inline-end" className="gap-1">
            <MicButton
              key={micKey}
              bare
              current={text}
              onTranscript={(t) => {
                setText(t);
                onActivity();
              }}
              onSpeaking={onMicPhase}
              onError={setMicError}
            />
            <InputGroupButton
              variant="default"
              size="icon-xs"
              className="size-7 rounded-full disabled:bg-primary/25 disabled:opacity-100"
              onClick={submit}
              disabled={!canAdd}
              aria-label="add task"
            >
              <ArrowUpIcon weight="bold" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {micError && <p role="alert" className="px-1 pt-2 text-xs text-destructive">{micError}</p>}
        {parsed && (
          <div className="flex min-w-0 items-center gap-2 px-1 pt-2 animate-in fade-in-0 slide-in-from-top-1">
            <Badge variant="outline" className="min-w-0 border-primary/20 bg-bubble text-bubble-foreground">
              <ClockIcon />
              <span className="truncate">
                {formatDue(parsed.due)}
                {parsed.recurring ? ", every day" : ""}
              </span>
            </Badge>
            <Button variant="link" size="xs" className="h-auto px-0 text-muted-foreground" onClick={submitPlain}>
              No time, just add it
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {openCount + doneToday.length + doneOlder.length === 0 && (
          <Empty className="py-6">
            <EmptyHeader className="gap-1">
              <EmptyTitle className="text-sm font-semibold">A fresh, empty day</EmptyTitle>
              <EmptyDescription className="text-[13px]">
                Type one small thing above, or hold the mic and just say it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {openCount === 0 && doneToday.length > 0 && (
          <div className="mb-1 rounded-lg bg-bubble px-3 py-2.5 font-medium text-bubble-foreground">
            All done for today. I'm so proud of us.
          </div>
        )}

        {timed.length > 0 && (
          <>
            <SectionLabel count={timed.length}>Scheduled</SectionLabel>
            {renderList(timed)}
          </>
        )}

        {plain.length > 0 && (
          <>
            <SectionLabel count={plain.length}>Anytime</SectionLabel>
            {renderList(plain)}
          </>
        )}

        {doneToday.length > 0 && (
          <>
            <SectionLabel count={doneToday.length}>Done today</SectionLabel>
            {renderList(doneToday)}
          </>
        )}

        {doneOlder.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 px-1 pt-4 pb-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <CaretDownIcon className="size-3 transition-transform group-data-[state=closed]:-rotate-90" weight="bold" />
              Earlier
              <span className="font-medium text-muted-foreground/70 tabular-nums">{doneOlder.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>{renderList(doneOlder)}</CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </Panel>
  );
}

function EditRow({
  editText,
  setEditText,
  editWhen,
  setEditWhen,
  editDue,
  onSave,
  onCancel,
}: {
  editText: string;
  setEditText: (s: string) => void;
  editWhen: string;
  setEditWhen: (s: string) => void;
  editDue: Date | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const whenOk = !editWhen.trim() || !!editDue;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };
  return (
    <div className="flex flex-col gap-2 bg-muted/40 p-2.5">
      <Input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={onKey} autoFocus aria-label="task" className="bg-card" />
      <div className="flex items-center gap-2">
        <Input
          value={editWhen}
          onChange={(e) => setEditWhen(e.target.value)}
          onKeyDown={onKey}
          placeholder="Time (optional), e.g. tomorrow 8am"
          aria-label="time"
          aria-invalid={!whenOk}
          className="flex-1 bg-card"
        />
        {editDue && (
          <Badge variant="outline" className="border-primary/20 bg-bubble text-bubble-foreground">
            <ClockIcon />
            {formatDue(editDue)}
          </Badge>
        )}
      </div>
      <div className="flex justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!editText.trim() || !whenOk} onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

function Row({
  todo,
  onToggle,
  onDelete,
  startEdit,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  startEdit: (t: Todo) => void;
}) {
  const due = todo.due ? new Date(todo.due) : null;
  // Past-due is a gentle amber, never alarm red (no guilt piles).
  const pastDue = !!due && !todo.done && due.getTime() < Date.now();
  return (
    <div className="group/row flex items-start gap-3 py-2.5 pr-2 pl-3">
      <Checkbox
        checked={todo.done}
        onCheckedChange={() => onToggle(todo.id)}
        aria-label={todo.done ? "mark not done" : "mark done"}
        className="mt-px size-[18px] rounded-full border-muted-foreground/40 bg-white data-checked:animate-check-pop [&_svg]:size-3 dark:bg-transparent"
      />
      <div className="min-w-0 flex-1">
        <div className={cn("leading-snug break-words", todo.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {todo.text}
        </div>
        {due && !todo.done && (
          <div className={cn("mt-0.5 flex items-center gap-1 text-xs font-medium", pastDue ? "text-warning" : "text-primary")}>
            <ClockIcon className="size-3" />
            {formatDue(due)}
            {todo.recurring && (
              <>
                <ArrowsClockwiseIcon className="ml-1 size-3" />
                Daily
              </>
            )}
          </div>
        )}
      </div>
      <div className="-my-1 flex opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
        {!todo.done && (
          <Button variant="ghost" size="icon-xs" onClick={() => startEdit(todo)} aria-label="edit" className="text-muted-foreground">
            <PencilSimpleIcon />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDelete(todo.id)}
          aria-label="delete"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon />
        </Button>
      </div>
    </div>
  );
}
