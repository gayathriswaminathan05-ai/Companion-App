import { useEffect, useState } from "react";
import { CalendarBlankIcon, CaretDownIcon, LockSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import type { Settings } from "../store";
import { GROWTH_LABEL, type GrowthStage, type WeekStats } from "../growth";
import { GrowthIcon, ListCard, Panel, PanelHeader, SectionLabel } from "@/components/panel";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Settings, in Blob's own voice. Grouped cards with the control on the right
// (Wispr Flow / Obsidian pattern), built from shadcn Item rows.

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Item size="sm" className="rounded-none border-0 px-3 py-2.5">
      <ItemContent className="gap-0.5">
        <ItemTitle className="text-[13px]">{label}</ItemTitle>
        {desc && <ItemDescription className="text-xs">{desc}</ItemDescription>}
      </ItemContent>
      {children && <ItemActions>{children}</ItemActions>}
    </Item>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 px-1 pt-2 text-xs leading-relaxed text-muted-foreground">
      <LockSimpleIcon className="mt-0.5 size-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Confirm({
  text,
  cancel,
  confirm,
  destructive,
  onCancel,
  onConfirm,
}: {
  text: string;
  cancel: string;
  confirm: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 bg-muted/40 p-3 animate-in fade-in-0">
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
      <div className="flex gap-1.5">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onCancel}>
          {cancel}
        </Button>
        <Button
          size="sm"
          className={destructive ? "flex-1 bg-destructive text-white hover:bg-destructive/90" : "flex-1"}
          onClick={onConfirm}
        >
          {confirm}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPanel({
  settings,
  facts,
  week,
  growthStage,
  onPatch,
  onDeleteFact,
  onClearChat,
  onChangeKey,
  onDeleteAll,
  onClose,
}: {
  settings: Settings;
  facts: string[];
  week: WeekStats;
  growthStage: GrowthStage;
  onPatch: (patch: Partial<Settings>) => void;
  onDeleteFact: (fact: string) => void;
  onClearChat: () => void | Promise<void>;
  onChangeKey: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  const [loginItem, setLoginItem] = useState(false);
  const [clearPhase, setClearPhase] = useState<"idle" | "clearing" | "done">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKey, setConfirmKey] = useState(false);
  const [calStatus, setCalStatus] = useState<{ hasClient: boolean; connected: boolean }>({
    hasClient: false,
    connected: false,
  });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [calBusy, setCalBusy] = useState(false);
  const [screenStatus, setScreenStatus] = useState<string>("unknown");
  const [calMsg, setCalMsg] = useState<string | null>(null);

  useEffect(() => {
    (window.companion.getLoginItem() as Promise<boolean>).then(setLoginItem);
    void window.companion.calendarStatus?.().then(setCalStatus);
    void window.companion.screenAccess?.().then(setScreenStatus);
  }, []);

  const toggleMatchBackdrop = async (on: boolean) => {
    onPatch({ matchBackdrop: on });
    if (on) {
      const status = await window.companion.screenAccess?.({ prompt: true });
      if (status) setScreenStatus(status);
    }
  };
  const needsScreenAccess = settings.matchBackdrop && screenStatus !== "granted";

  const refreshCal = async () => {
    const s = await window.companion.calendarStatus?.();
    if (s) setCalStatus(s);
  };

  const canConnect =
    calStatus.hasClient || (!!clientId.trim() && !!clientSecret.trim());

  const connectCalendar = async () => {
    setCalBusy(true);
    setCalMsg(null);
    // Save keys first if she just pasted them (one-tap flow).
    if (clientId.trim() && clientSecret.trim()) {
      const saved = await window.companion.calendarSaveClient?.({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
      if (!saved?.ok) {
        setCalBusy(false);
        setCalMsg(saved?.error || "Couldn't save keys");
        return;
      }
      setClientSecret("");
      await refreshCal();
    }
    setCalMsg("Opening Google...");
    const res = await window.companion.calendarConnect?.();
    setCalBusy(false);
    if (res?.ok) {
      setCalMsg(null);
      await refreshCal();
    } else {
      setCalMsg(res?.error || "Couldn't connect");
    }
  };

  const disconnectCalendar = async () => {
    setCalBusy(true);
    await window.companion.calendarDisconnect?.();
    setCalBusy(false);
    setCalMsg("Disconnected");
    await refreshCal();
  };

  const runClearChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clearPhase !== "idle") return;
    setClearPhase("clearing");
    const started = Date.now();
    try {
      await onClearChat();
    } catch {
      /* still show done; UI state is cleared in parent */
    }
    const wait = Math.max(0, 700 - (Date.now() - started));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    setClearPhase("done");
    window.setTimeout(() => setClearPhase("idle"), 2200);
  };

  const weekQuiet = week.wellness === 0 && week.taskBonus === 0;

  return (
    <Panel onMouseDown={(e) => e.stopPropagation()}>
      <PanelHeader title="Settings" onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <SectionLabel>This week</SectionLabel>
        <ListCard>
          <div className="flex items-center gap-3 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
              <GrowthIcon stage={growthStage} className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-medium">Today I'm {GROWTH_LABEL[growthStage]}</div>
              <div className="text-xs text-muted-foreground">
                {weekQuiet
                  ? "A quiet week so far. Stretch, sip water or finish a timed task and I'll grow."
                  : "Every stretch, sip and timed task helps me grow."}
              </div>
            </div>
          </div>
          {!weekQuiet && (
            <div className="grid grid-cols-3 divide-x">
              <Stat value={week.wellness} label="Self-care" />
              <Stat value={week.taskBonus} label="Timed tasks" />
              <div className="px-3 py-2">
                <GrowthIcon stage={week.stagePeak} className="size-5 text-success" />
                <div className="mt-0.5 text-[11px] text-muted-foreground">Best bloom</div>
              </div>
            </div>
          )}
        </ListCard>

        <SectionLabel>Me and you</SectionLabel>
        <ListCard>
          <Row label="My name">
            <Input
              className="h-7 w-32 rounded-md text-right"
              value={settings.companionName}
              onChange={(e) => onPatch({ companionName: e.target.value })}
              aria-label="companion name"
            />
          </Row>
          <Row label="What I call you">
            <Input
              className="h-7 w-32 rounded-md text-right"
              placeholder="Your name"
              value={settings.userName}
              onChange={(e) => onPatch({ userName: e.target.value })}
              aria-label="your name"
            />
          </Row>
          <Row label="My little sounds" desc="Chirps, giggles and sleepy yawns">
            <Switch checked={settings.soundsOn} onCheckedChange={(v) => onPatch({ soundsOn: v })} aria-label="sounds" />
          </Row>
          <Row label="How big I look">
            <Slider
              className="w-28"
              min={0.6}
              max={1.2}
              step={0.05}
              value={[settings.plantScale]}
              onValueChange={([v]) => onPatch({ plantScale: v })}
              aria-label="plant size"
            />
          </Row>
          <Row label="How big my windows are">
            <Slider
              className="w-28"
              min={0.85}
              max={1.45}
              step={0.05}
              value={[settings.panelScale]}
              onValueChange={([v]) => onPatch({ panelScale: v })}
              aria-label="window size"
            />
          </Row>
          <Row
            label="Match what's behind me"
            desc={
              needsScreenAccess ? (
                <span className="text-warning">
                  Allow me under Screen Recording in System Settings, then reopen me.
                </span>
              ) : (
                "Dark windows over light apps, light over dark"
              )
            }
          >
            {needsScreenAccess && (
              <Button variant="secondary" size="sm" onClick={() => void window.companion.screenAccess?.({ prompt: true }).then(setScreenStatus)}>
                Open
              </Button>
            )}
            <Switch
              checked={settings.matchBackdrop}
              onCheckedChange={(v) => void toggleMatchBackdrop(v)}
              aria-label="match what's behind me"
            />
          </Row>
        </ListCard>
        {settings.matchBackdrop && (
          <Note>I only check how bright the screen is around me, a few times a minute, on this Mac. Nothing is saved or sent.</Note>
        )}

        <SectionLabel>How I care for you</SectionLabel>
        <ListCard>
          <Row label="Stretch breaks" desc="I'll nudge you to move">
            <NativeSelect
              size="sm"
              value={String(settings.breakMins)}
              onChange={(e) => onPatch({ breakMins: Number(e.target.value) })}
              aria-label="stretch interval"
            >
              <NativeSelectOption value="0">Never</NativeSelectOption>
              <NativeSelectOption value="30">Every 30 min</NativeSelectOption>
              <NativeSelectOption value="45">Every 45 min</NativeSelectOption>
              <NativeSelectOption value="60">Every hour</NativeSelectOption>
              <NativeSelectOption value="90">Every 90 min</NativeSelectOption>
            </NativeSelect>
          </Row>
          <Row label="Water breaks" desc="Every couple of hours">
            <Switch checked={settings.waterNudge} onCheckedChange={(v) => onPatch({ waterNudge: v })} aria-label="water breaks" />
          </Row>
          <Row label="Bedtime" desc={settings.bedtime ? "I'll yawn and tuck you in" : "Off"}>
            {settings.bedtime && (
              <Input
                type="time"
                className="h-7 w-[116px] rounded-md pr-1.5 [&::-webkit-calendar-picker-indicator]:opacity-40"
                value={settings.bedtime}
                onChange={(e) => onPatch({ bedtime: e.target.value })}
                aria-label="bedtime"
              />
            )}
            <Switch
              checked={!!settings.bedtime}
              onCheckedChange={(v) => onPatch({ bedtime: v ? "23:00" : null })}
              aria-label="bedtime"
            />
          </Row>
          <Row label="My jokes">
            <NativeSelect
              size="sm"
              value={settings.jokeEvery}
              onChange={(e) => onPatch({ jokeEvery: e.target.value as Settings["jokeEvery"] })}
              aria-label="joke frequency"
            >
              <NativeSelectOption value="often">Often (3h)</NativeSelectOption>
              <NativeSelectOption value="rare">Rarely (6h)</NativeSelectOption>
              <NativeSelectOption value="off">None, please</NativeSelectOption>
            </NativeSelect>
          </Row>
          <Row label="Hide during calls" desc="Zoom and Google Meet">
            <Switch
              checked={settings.autoHideOnCalls}
              onCheckedChange={(v) => onPatch({ autoHideOnCalls: v })}
              aria-label="hide during calls"
            />
          </Row>
        </ListCard>

        <SectionLabel>Calendar</SectionLabel>
        <ListCard>
          <Row
            label="Google Calendar"
            desc={
              calStatus.connected ? (
                <span className="font-medium text-success">Connected</span>
              ) : (
                "Meeting pings, read-only"
              )
            }
          >
            {calStatus.connected ? (
              <Button variant="secondary" size="sm" disabled={calBusy} onClick={() => void disconnectCalendar()}>
                Disconnect
              </Button>
            ) : (
              <CalendarBlankIcon className="size-4 text-muted-foreground" />
            )}
          </Row>
          {!calStatus.connected && (
            <div className="flex flex-col gap-2 p-3">
              {!calStatus.hasClient ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Paste your Client ID and Secret, then connect. (Google Cloud, Credentials, OAuth
                    Desktop client)
                  </p>
                  <Input placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
                  <Input
                    placeholder="Client Secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    autoComplete="off"
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Keys saved. Connect to sign in with Google.</p>
              )}
              <Button disabled={calBusy || !canConnect} onClick={() => void connectCalendar()}>
                {calBusy && <Spinner />}
                {calBusy ? "Working..." : "Connect Google Calendar"}
              </Button>
            </div>
          )}
          <Row label="Remind me before meetings">
            <Switch
              checked={settings.calendarReminders}
              onCheckedChange={(v) => onPatch({ calendarReminders: v })}
              aria-label="meeting reminders"
            />
          </Row>
          <Row label="How early">
            <NativeSelect
              size="sm"
              value={String(settings.calendarLeadMins)}
              onChange={(e) => onPatch({ calendarLeadMins: Number(e.target.value) })}
              aria-label="minutes before meeting"
            >
              <NativeSelectOption value="5">5 min</NativeSelectOption>
              <NativeSelectOption value="10">10 min</NativeSelectOption>
              <NativeSelectOption value="15">15 min</NativeSelectOption>
              <NativeSelectOption value="30">30 min</NativeSelectOption>
            </NativeSelect>
          </Row>
        </ListCard>
        {calMsg && <p className="px-1 pt-2 text-xs text-muted-foreground">{calMsg}</p>}
        <Note>Meeting titles stay in memory for a moment. They're never saved and never sent to Claude.</Note>

        <SectionLabel>What I remember</SectionLabel>
        <Collapsible>
          <ListCard>
            <CollapsibleTrigger className="group w-full text-left hover:bg-muted/40" disabled={facts.length === 0}>
              <Row
                label="Memories of you"
                desc={facts.length === 0 ? "Nothing yet. Talk to me more." : `${facts.length} little things`}
              >
                {facts.length > 0 && (
                  <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                )}
              </Row>
            </CollapsibleTrigger>
            <CollapsibleContent className="divide-y border-t">
              {facts.map((f) => (
                <div key={f} className="group/fact flex items-start gap-2 py-2 pr-2 pl-3">
                  <span className="min-w-0 flex-1 pt-0.5 select-text">{f}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDeleteFact(f)}
                    aria-label="forget this"
                    title="Forget this"
                    className="text-muted-foreground opacity-0 group-hover/fact:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </ListCard>
        </Collapsible>

        <SectionLabel>App</SectionLabel>
        <ListCard>
          <Row label="Wake up with your Mac">
            <Switch
              checked={loginItem}
              onCheckedChange={(v) => {
                setLoginItem(v);
                void window.companion.setLoginItem(v);
              }}
              aria-label="start at login"
            />
          </Row>
          {!confirmKey ? (
            <Row label="My brain key" desc="Your Claude API key">
              <Button variant="secondary" size="sm" onClick={() => setConfirmKey(true)}>
                Change key
              </Button>
            </Row>
          ) : (
            <Confirm
              text="This unplugs my brain until you paste a new key. Our chats and memories stay safe."
              cancel="Keep it"
              confirm="Change key"
              onCancel={() => setConfirmKey(false)}
              onConfirm={() => {
                setConfirmKey(false);
                onChangeKey();
              }}
            />
          )}
        </ListCard>

        <SectionLabel>Privacy</SectionLabel>
        <ListCard>
          <Row label="Chat history" desc="Deletes our messages. Memories stay.">
            {clearPhase === "idle" && (
              <Button variant="secondary" size="sm" onClick={runClearChat}>
                Delete
              </Button>
            )}
            {clearPhase === "clearing" && <Spinner className="mx-3 text-muted-foreground" />}
            {clearPhase === "done" && (
              <Badge variant="secondary" className="bg-success-soft text-success">
                Deleted
              </Badge>
            )}
          </Row>
          {!confirmDelete ? (
            <Row label="Everything" desc="Tasks, chats, memories, settings">
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete all
              </Button>
            </Row>
          ) : (
            <Confirm
              text="This wipes everything I know and starts us fresh. There's no undo."
              cancel="No, wait"
              confirm="Forget everything"
              destructive
              onCancel={() => setConfirmDelete(false)}
              onConfirm={onDeleteAll}
            />
          )}
        </ListCard>
        <Note>
          Everything lives on this computer. Chats go to Claude only to think of a reply, never stored and
          never used for training. Your voice never leaves at all.
        </Note>

        <p className="pt-4 text-center text-[11px] text-muted-foreground/70">Companion 0.1.0 beta</p>
      </div>
    </Panel>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-3 py-2">
      <div className="text-base leading-5 font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
