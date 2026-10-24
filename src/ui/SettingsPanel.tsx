import { version as appVersion } from "../../package.json";
import MeditationReminderForm from "./MeditationReminderForm";
import { useEffect, useState } from "react";
import {
  BellRingingIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  ChatCircleDotsIcon,
  HandGrabbingIcon,
  LockSimpleIcon,
  MoonStarsIcon,
  PersonSimpleTaiChiIcon,
  PlantIcon,
  SmileyWinkIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Settings } from "../store";
import { GROWTH_LABEL, GROWTH_MAX_POINTS, type GrowthStage, type WeekStats } from "../growth";
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
import { ACCENTS, CLOUD_VOICES, speak, type CloudVoice } from "../voice";
import { cn } from "@/lib/utils";
import { FEATURES } from "../features";

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
        {desc && <ItemDescription className="line-clamp-none text-xs">{desc}</ItemDescription>}
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
  points,
  onPatch,
  onDeleteFact,
  onClearChat,
  onChangeKey,
  onDeleteAll,
  onClose,
  showKeyRow = true,
  hasChatHistory = false,
  aiName = "ChatGPT",
  cloudVoice,
  onScheduleMeditation,
  onOpenReminderTests,
  onOpenSetup,
  onOpenTour,
}: {
  onOpenTour?: () => void;
  onOpenSetup?: () => void;
  onOpenReminderTests?: () => void;
  onScheduleMeditation?: (due: Date, recurring?: "daily") => void;
  settings: Settings;
  facts: string[];
  week: WeekStats;
  growthStage: GrowthStage;
  /** Today's growth points (0–12). */
  points: number;
  onPatch: (patch: Partial<Settings>) => void;
  onDeleteFact: (fact: string) => void;
  onClearChat: () => void | Promise<void>;
  onChangeKey: () => void;
  onDeleteAll: () => void | Promise<void>;
  onClose: () => void;
  /** Hidden for beta testers, whose chats go through the proxy (no key). */
  showKeyRow?: boolean;
  hasChatHistory?: boolean;
  /** "ChatGPT": who answers chat (from the saved key / beta build). */
  aiName?: string;
  /** Google voice available (online via proxy or local key) + region accent. */
  cloudVoice?: { available: boolean; autoAccent: string };
}) {
  const [meditationForm, setMeditationForm] = useState(false);
  const [meditationNote, setMeditationNote] = useState("");
  const [loginItem, setLoginItem] = useState(false);
  const [clearPhase, setClearPhase] = useState<"idle" | "clearing" | "done" | "error">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [confirmKey, setConfirmKey] = useState(false);
  const [calStatus, setCalStatus] = useState<{
    hasClient: boolean;
    connected: boolean;
    canCreateEvents?: boolean;
    gmail?: boolean;
  }>({
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

  const cloud = !!cloudVoice?.available;
  const preview = (line: string, o: { cloudVoice?: string; accent?: string; kokoro?: string } = {}) => {
    if (!settings.voiceOn) return;
    let c: CloudVoice | null = null;
    if (cloud) {
      const pick = o.accent ?? settings.voiceAccent ?? "auto";
      const lang = pick === "auto" ? cloudVoice?.autoAccent || "en-US" : pick;
      c = { languageCode: lang, voiceName: `${lang}-Chirp3-HD-${o.cloudVoice ?? settings.cloudVoice ?? "Puck"}` };
    }
    void speak(line, { speed: (o.kokoro ?? settings.voiceName) === "af_bella" ? 1.0 : undefined, voice: o.kokoro ?? settings.voiceName ?? "af_heart", cloud: c });
  };

  const refreshCal = async () => {
    const s = await window.companion.calendarStatus?.();
    if (s) setCalStatus(s);
  };

  const needsGoogleUpgrade =
    calStatus.connected && ((FEATURES.aiChat && !calStatus.canCreateEvents) || (FEATURES.gmailAlerts && !calStatus.gmail));

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
    try {
      const result = await window.companion.calendarDisconnect?.();
      setCalMsg(result?.ok ? "Disconnected" : "Could not remove the connection. Please retry.");
      await refreshCal();
    } catch {
      setCalMsg("Could not remove the connection. Please retry.");
    } finally { setCalBusy(false); }
  };

  const runClearChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clearPhase === "clearing") return;
    setClearPhase("clearing");
    const started = Date.now();
    try {
      await onClearChat();
    } catch {
      setClearPhase("error");
      return;
    }
    const wait = Math.max(0, 700 - (Date.now() - started));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    setClearPhase("done");
    window.setTimeout(() => setClearPhase("idle"), 2200);
  };

  const weekQuiet = week.wellness === 0 && week.taskBonus === 0;

  if (meditationForm && onScheduleMeditation) return <MeditationReminderForm onBack={() => setMeditationForm(false)} onSchedule={(due, recurring) => { onScheduleMeditation(due, recurring); setMeditationNote(recurring ? "Daily meditation reminder saved. Manage it in Tasks." : "Meditation reminder saved. Manage it in Tasks."); setMeditationForm(false); }} />;

  return (
    <Panel onMouseDown={(e) => e.stopPropagation()}>
      <PanelHeader title="Settings" onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {onOpenReminderTests && <Button variant="secondary" className="mb-3 w-full justify-start" onClick={onOpenReminderTests}><BellRingingIcon />Test reminders & jokes</Button>}
        <SectionLabel>Today</SectionLabel>
        <ListCard>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-soft">
                <GrowthIcon stage={growthStage} className="size-10" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">Today I'm {GROWTH_LABEL[growthStage]}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  Stage {growthStage} of 7 · {points} of {GROWTH_MAX_POINTS} points
                </div>
              </div>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="How much I've grown today"
              aria-valuemin={0}
              aria-valuemax={GROWTH_MAX_POINTS}
              aria-valuenow={points}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2ea064] via-[#7fd38a] to-[#f2a2bd] transition-[width] duration-500"
                style={{ width: `${(Math.min(points, GROWTH_MAX_POINTS) / GROWTH_MAX_POINTS) * 100}%` }}
              />
            </div>
            <div className="flex justify-between px-0.5" aria-hidden>
              {STAGES.map((n) => (
                <GrowthIcon
                  key={n}
                  stage={n}
                  className={cn(
                    "size-6 transition",
                    n > growthStage && "opacity-45 grayscale-[0.6]",
                    n === growthStage && "scale-125 drop-shadow-sm",
                  )}
                />
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{nextStepHint(growthStage, points)}</p>
          </div>
          {!weekQuiet && (
            <div className="grid grid-cols-3 divide-x">
              <Stat value={week.wellness} label="Self-care this week" />
              <Stat value={week.taskBonus} label="Timed tasks" />
              <div className="px-3 py-2">
                <GrowthIcon stage={week.stagePeak} className="size-6" />
                <div className="mt-0.5 text-[11px] text-muted-foreground">Best bloom</div>
              </div>
            </div>
          )}
        </ListCard>

        <SectionLabel>How I work</SectionLabel>
        {onOpenTour && <Button variant="outline" className="mb-2 w-full" onClick={onOpenTour}>Show me around</Button>}
        <Collapsible>
          <ListCard>
            <CollapsibleTrigger className="group w-full text-left hover:bg-muted/40">
              <Row label="A quick guide to me" desc="What I do, and how I grow with you">
                <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </Row>
            </CollapsibleTrigger>
            <CollapsibleContent className="divide-y border-t">
              <HowRow icon={PlantIcon} tone="bg-success/12 text-success" title="I grow when you look after yourself">
                A stretch or water break is +2, a finished timed task is +1. {GROWTH_MAX_POINTS} points is full bloom. I
                start small again every morning, so there are no streaks and no guilt.
              </HowRow>
              <HowRow icon={PersonSimpleTaiChiIcon} tone="bg-primary/12 text-primary" title="Gentle nudges">
                {settings.breakMins > 0
                  ? `I suggest a movement break after about ${settings.breakMins} minutes of work`
                  : "Stretch nudges are off"}
                {settings.waterNudge ? `, and a water break every ${settings.waterMins} minutes` : ""}. Never more than
                four a day{settings.autoHideOnCalls ? ", and I hide while you're on a call" : ""}.
              </HowRow>
              <HowRow icon={BellRingingIcon} tone="bg-[#e8a04a]/16 text-warning" title="Reminders">
                Type or dictate “call mom at 6” in Tasks. Check the time before saving. I can alert you while the app is running and your Mac is awake
                {settings.calendarReminders ? ". Meetings too, from your calendar" : ""}.
              </HowRow>
              {FEATURES.aiChat && <HowRow icon={ChatCircleDotsIcon} tone="bg-[#2f6fb3]/12 text-[#2f6fb3] dark:text-[#8db8ec]" title="Chat with me">
                Click me, then Chat. Vent, plan or ask anything. I use recent conversation to reply. Your task list, calendar and saved notes are not automatically shared.
              </HowRow>}
              <HowRow icon={SmileyWinkIcon} tone="bg-[#f2a2bd]/22 text-[#c2416b] dark:text-[#f2a2bd]" title="Silly jokes">
                {settings.jokeEvery === "off"
                  ? "Jokes are off. Switch them on below if you'd like a giggle."
                  : `About every ${settings.jokeEvery === "rare" ? 6 : 3} hours I tell you one. Tap “What?” for the punchline.`}
              </HowRow>
              <HowRow icon={MoonStarsIcon} tone="bg-primary/12 text-primary" title="Bedtime">
                {settings.bedtime
                  ? `At ${clock12(settings.bedtime)} I get sleepy, say goodnight and nudge you to rest.`
                  : "Bedtime care is off. Set a time below and I'll remind you to rest."}
              </HowRow>
              <HowRow icon={HandGrabbingIcon} tone="bg-muted text-foreground" title="Moving me around">
                Click me for the menu, drag me anywhere on your screen, or tap Nap in the menu to tuck me away for a bit.
              </HowRow>
            </CollapsibleContent>
          </ListCard>
        </Collapsible>

        <SectionLabel>Me and you</SectionLabel>
        <ListCard>
          <Row label="My name">
            <Input
              className="h-7 w-32 rounded-md text-left"
              value={settings.companionName}
              onChange={(e) => onPatch({ companionName: e.target.value })}
              aria-label="companion name"
            />
          </Row>
          <Row label="What I call you">
            <Input
              className="h-7 w-32 rounded-md text-left"
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

        <SectionLabel>My voice</SectionLabel>
        <ListCard>
          <Row label="Talk out loud" desc="Reminders, meetings, nudges and jokes">
            <Switch checked={settings.voiceOn} onCheckedChange={(v) => onPatch({ voiceOn: v })} aria-label="voice" />
          </Row>
          {FEATURES.aiChat && <Row label="Read chat replies aloud" desc="You can also mute this from the chat">
            <Switch
              checked={settings.voiceOn && settings.voiceChat}
              disabled={!settings.voiceOn}
              onCheckedChange={(v) => onPatch({ voiceChat: v })}
              aria-label="read chat replies aloud"
            />
          </Row>}
          <Row label="How I sound">
            {cloud ? (
              <NativeSelect
                size="sm"
                value={settings.cloudVoice || "Puck"}
                onChange={(e) => {
                  onPatch({ cloudVoice: e.target.value });
                  preview("hi! this is how I sound now.", { cloudVoice: e.target.value });
                }}
                aria-label="voice"
                disabled={!settings.voiceOn}
              >
                {CLOUD_VOICES.map((v) => (
                  <NativeSelectOption key={v.id} value={v.id}>
                    {v.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <NativeSelect
                size="sm"
                value={settings.voiceName || "af_heart"}
                onChange={(e) => {
                  onPatch({ voiceName: e.target.value });
                  preview("hi! this is how I sound now.", { kokoro: e.target.value });
                }}
                aria-label="voice"
                disabled={!settings.voiceOn}
              >
                <NativeSelectOption value="af_heart">Warm original</NativeSelectOption>
                <NativeSelectOption value="af_bella">Bubbly friend</NativeSelectOption>
                <NativeSelectOption value="af_sky">Light</NativeSelectOption>
              </NativeSelect>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.voiceOn}
              onClick={() => preview("hey! it's time to drink some water.")}
            >
              Play
            </Button>
          </Row>
          {cloud && (
            <Row label="Accent" desc="How I pronounce names and words">
              <NativeSelect
                size="sm"
                value={settings.voiceAccent || "auto"}
                onChange={(e) => {
                  onPatch({ voiceAccent: e.target.value });
                  preview("hi! this is my new accent.", { accent: e.target.value });
                }}
                aria-label="accent"
                disabled={!settings.voiceOn}
              >
                <NativeSelectOption value="auto">
                  Auto ({ACCENTS.find((x) => x.id === cloudVoice?.autoAccent)?.label ?? "your region"})
                </NativeSelectOption>
                {ACCENTS.map((x) => (
                  <NativeSelectOption key={x.id} value={x.id}>
                    {x.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Row>
          )}
        </ListCard>
        <Note>
          {cloud
            ? "Online, my voice comes from Google through our private server and isn't stored. Meeting titles and email senders always use my on-device voice."
            : "My voice is made right here on your Mac. Nothing you hear is sent anywhere."}
        </Note>

        <SectionLabel>How I care for you</SectionLabel>
        {onOpenSetup && <Button variant="secondary" className="mb-2 w-full justify-start" onClick={onOpenSetup}><PlantIcon />Set up my care routine</Button>}
        <ListCard>
          <Row label="Movement breaks" desc="A stretch, a short walk or a little movement">
            <NativeSelect
              size="sm"
              value={String(settings.breakMins)}
              onChange={(e) => onPatch({ breakMins: Number(e.target.value) })}
              aria-label="movement interval"
            >
              <NativeSelectOption value="0">Never</NativeSelectOption>
              <NativeSelectOption value="30">Every 30 min</NativeSelectOption>
              <NativeSelectOption value="45">Every 45 min</NativeSelectOption>
              <NativeSelectOption value="60">Every hour</NativeSelectOption>
              <NativeSelectOption value="90">Every 90 min</NativeSelectOption>
            </NativeSelect>
          </Row>
          <Row label="Movement style">
            <NativeSelect size="sm" aria-label="movement style" value={settings.movementStyle || "mixed"} onChange={e => onPatch({ movementStyle: e.target.value as Settings["movementStyle"] })}>
              <NativeSelectOption value="mixed">Mix it up</NativeSelectOption><NativeSelectOption value="stretch">Stretch</NativeSelectOption><NativeSelectOption value="walk">Walk or move</NativeSelectOption>
            </NativeSelect>
          </Row>
          {onScheduleMeditation && <Row label="Meditation reminder" desc={meditationNote || "Make room for a quiet moment"}><Button size="sm" variant="secondary" onClick={() => setMeditationForm(true)}>Set reminder</Button></Row>}
          <Row label="Water breaks" desc="I'll remind you to sip">
            <NativeSelect
              size="sm"
              value={settings.waterNudge ? String(settings.waterMins || 120) : "0"}
              onChange={(e) => {
                const mins = Number(e.target.value);
                onPatch(mins ? { waterNudge: true, waterMins: mins } : { waterNudge: false });
              }}
              aria-label="water break interval"
            >
              <NativeSelectOption value="0">Never</NativeSelectOption>
              <NativeSelectOption value="30">Every 30 min</NativeSelectOption>
              <NativeSelectOption value="45">Every 45 min</NativeSelectOption>
              <NativeSelectOption value="60">Every hour</NativeSelectOption>
              <NativeSelectOption value="90">Every 90 min</NativeSelectOption>
              <NativeSelectOption value="120">Every 2 hours</NativeSelectOption>
              <NativeSelectOption value="180">Every 3 hours</NativeSelectOption>
            </NativeSelect>
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

        <SectionLabel>Google</SectionLabel>
        <ListCard>
          <Row
            label={FEATURES.gmailAlerts ? "Calendar and Gmail" : "Google Calendar"}
            desc={
              calStatus.connected ? (
                needsGoogleUpgrade ? (
                  <span className="text-warning">
                    {FEATURES.gmailAlerts ? "Reconnect to let me book meetings and spot new emails" : "Reconnect to let me book meetings"}
                  </span>
                ) : (
                  <span className="font-medium text-success">Connected</span>
                )
              ) : (
                FEATURES.gmailAlerts ? "Meeting pings, booking and new-email alerts" : FEATURES.aiChat ? "Meeting pings and booking" : "Upcoming events and meeting alerts"
              )
            }
          >
            {calStatus.connected ? (
              needsGoogleUpgrade ? (
                <Button size="sm" disabled={calBusy} onClick={() => void connectCalendar()}>
                  Reconnect
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled={calBusy} onClick={() => void disconnectCalendar()}>
                  Disconnect
                </Button>
              )
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
                <p className="text-xs text-muted-foreground">Connect to choose your Google account.</p>
              )}
              <Button disabled={calBusy || !canConnect} onClick={() => void connectCalendar()}>
                {calBusy && <Spinner />}
                {calBusy ? "Working..." : "Connect Google"}
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
          {FEATURES.gmailAlerts && (
          <Row
            label="Tell me about new emails"
            desc={calStatus.connected && !calStatus.gmail ? "Needs Gmail access, reconnect above" : "Primary inbox only, sender and subject"}
          >
            <Switch
              checked={settings.gmailAlerts}
              onCheckedChange={(v) => onPatch({ gmailAlerts: v })}
              aria-label="new email alerts"
            />
          </Row>
          )}
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
        <Note>
          {FEATURES.gmailAlerts
            ? "Meeting titles and email senders stay in memory for a moment. They're never saved and never sent to the AI. I can only read email headers, never the emails themselves."
            : "Meeting titles stay in memory for a moment. They're never saved and never sent to the AI."}
        </Note>

        {(FEATURES.aiChat || facts.length > 0) && <>
        <SectionLabel>{FEATURES.aiChat ? "What I remember" : "Notes from an earlier version"}</SectionLabel>
        <Collapsible>
          <ListCard>
            <CollapsibleTrigger className="group w-full text-left hover:bg-muted/40" disabled={facts.length === 0}>
              <Row
                label="Memories of you"
                desc={facts.length === 0 ? "No saved notes on this Mac" : `${facts.length} notes, kept on this Mac`}
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

        <Note>Saved notes are not automatically shared with AI. Forgetting a note does not remove it from earlier chat messages; delete chat history separately.</Note>
        </>}

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
          {!FEATURES.aiChat || !showKeyRow ? null : !confirmKey ? (
            <Row label="My brain key" desc="Your OpenAI API key">
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
          {FEATURES.aiChat ? <Row label="Chat privacy" desc={`When you send, recent chat (up to 16 messages, including your new message) goes to ${aiName}, through our beta server. The provider may retain it. Tasks and saved notes are not added.`} /> : <Row label="On your Mac" desc="Tasks, reminders and settings are saved here. This beta has no AI chat. Voice typing and speaking run on your Mac." />}
          {(FEATURES.aiChat || hasChatHistory) && <Row label={FEATURES.aiChat ? "Chat history" : "Earlier chat history"} desc="Deletes messages and summaries on this Mac. Saved notes stay.">
            {clearPhase === "idle" && (
              <Button variant="secondary" size="sm" onClick={runClearChat}>
                Delete
              </Button>
            )}
            {clearPhase === "error" && <Button size="sm" variant="secondary" onClick={runClearChat}>Retry delete</Button>}
            {clearPhase === "clearing" && <Spinner className="mx-3 text-muted-foreground" />}
            {clearPhase === "done" && (
              <Badge variant="secondary" className="bg-success-soft text-success">
                Deleted
              </Badge>
            )}
          </Row>}
          {!confirmDelete ? (
            <Row label="Everything" desc="Local app data, personal keys and Google connection">
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete all
              </Button>
            </Row>
          ) : (
            <Confirm
              text="Deletes tasks, chats, saved notes, settings and personal keys from this Mac, disconnects Google and turns off start at login. Provider records and your Google Calendar are not deleted. There is no undo."
              cancel="No, wait"
              confirm="Forget everything"
              destructive
              onCancel={() => { setConfirmDelete(false); setDeleteError(false); }}
              onConfirm={() => {
                setDeleteError(false);
                void Promise.resolve().then(onDeleteAll).catch(() => setDeleteError(true));
              }}
            />
          )}
        </ListCard>
        {deleteError && <p role="alert" className="px-1 pt-2 text-xs text-destructive">Could not remove all local data. Please try again.</p>}
        {clearPhase === "error" && <p role="alert" className="px-1 pt-2 text-xs text-destructive">Could not save the deletion. Please retry.</p>}
        {FEATURES.aiChat ? <>
        <Note>
          Chat is part of your plant. Only messages you send start an AI request; typing a draft does not. Deleting chat history stops the current reply, but cannot recall information already sent. Tasks, saved notes and fetched calendar events are not automatically shared. If you type those details in chat, they are sent as part of that conversation.
        </Note>
        <Note>
          Chat uses recent messages and local time to reply and set reminders. The beta relays it through our server without logging conversation content; a daily device counter limits use. Research can send search terms to search services. The AI provider may retain data under its policies. Deleting local data does not delete provider records. Voice recognition and speaking run on your Mac.
        </Note>
        </> : <Note>Google Calendar is optional. Connecting it contacts Google to fetch upcoming events for alerts. Event details stay in memory and are not saved by this app. Disconnect in Google Calendar above. No AI chat or cloud voice requests run in this beta.</Note>}

        <p className="pt-4 text-center text-[11px] text-muted-foreground/70">Companion {appVersion}</p>
      </div>
    </Panel>
  );
}

const STAGES: GrowthStage[] = [1, 2, 3, 4, 5, 6, 7];

/** What gets me to the next stage, in plain words. */
function nextStepHint(stage: GrowthStage, points: number): string {
  if (stage === 7) return "In full bloom today! Tomorrow I start small again, tiny sprouts and all.";
  const need = stage * 2 - points; // stage N+1 starts at 2N points
  const next = GROWTH_LABEL[(stage + 1) as GrowthStage];
  return need <= 1
    ? `1 more point to ${next}: a stretch, a sip of water or a timed task.`
    : `${need} more points to ${next}: one stretch or a glass of water.`;
}

/** "23:00" → "11:00 PM" */
function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** One line of the "How I work" guide: colour icon tile + short explanation. */
function HowRow({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" | "bold" | "duotone" }>;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-[18px]" weight="duotone" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
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
