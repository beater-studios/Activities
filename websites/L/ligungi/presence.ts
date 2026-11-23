import { ActivityType, Assets } from 'premid'

const presence = new Presence({
  clientId: '1573429066755739949',
})
const browsingTimestamp = Math.floor(Date.now() / 1000)

enum ActivityAssets {
  Logo = 'https://i.imgur.com/ppVv7VX.png',
}

const MODES: Record<string, string> = {
  intro: 'Introductory',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

// The site's pages, by address: [address, top line, bottom line].
const PAGES: [RegExp, string, string][] = [
  [/^\/$/, 'Browsing', 'Home'],
  [/^\/learn$/, 'Learning', 'The rules'],
  [/^\/lessons(?:\/.*)?$/, 'Learning', 'Lessons'],
  [/^\/practice(?:\/.*)?$/, 'Learning', 'Practice'],
  [/^\/coordinates$/, 'Training', 'Coordinates'],
  [/^\/puzzles\/daily$/, 'Solving puzzles', 'Daily puzzle'],
  [/^\/puzzles\/dashboard$/, 'Solving puzzles', 'Puzzle dashboard'],
  [/^\/puzzles(?:\/[0-9a-f]{8})?$/, 'Solving puzzles', 'Puzzles'],
  [/^\/streak$/, 'Solving puzzles', 'Puzzle Streak'],
  [/^\/storm$/, 'Solving puzzles', 'Puzzle Storm'],
  [/^\/analysis$/, 'Studying', 'Analysis board'],
  [/^\/editor$/, 'Studying', 'Board editor'],
  [/^\/explorer$/, 'Studying', 'Draft explorer'],
  [/^\/study(?:\/.*)?$/, 'Studying', 'Studies'],
  [/^\/tv(?:\/.*)?$/, 'Watching', 'ligungi TV'],
  [/^\/games$/, 'Browsing', 'Game search'],
  [/^\/players$/, 'Browsing', 'Players'],
  [/^\/ranking(?:\/.*)?$/, 'Browsing', 'Leaderboard'],
  [/^\/@\/[\w-]+(?:\/insights)?$/, 'Browsing', 'A player profile'],
  [/^\/challenge\/\w+$/, 'Waiting', 'For a challenge to be accepted'],
  [/^\/computer$/, 'Setting up a game', 'Against the computer'],
]

// ligungi describes what the player is doing in data-activity-* attributes on <html>, in English machine values,
// so this does not depend on the site's language or layout (see "Browser integrations" in the site's docs/architecture.md).
function activity(name: string): string | null {
  return document.documentElement.getAttribute(`data-activity-${name}`)
}

// The elapsed time restarts with each game, not with each page load (ligungi TV keeps its address while its game changes).
let timer = { key: '', since: browsingTimestamp }
function since(key: string): number {
  if (timer.key !== key)
    timer = { key, since: Math.floor(Date.now() / 1000) }
  return timer.since
}

presence.on('UpdateData', async () => {
  const [privacy, showButtons] = await Promise.all([
    presence.getSetting<boolean>('privacyMode'),
    presence.getSetting<boolean>('showButtons'),
  ])
  const { pathname, href } = document.location
  const presenceData: PresenceData = {
    type: ActivityType.Playing,
    largeImageKey: ActivityAssets.Logo,
    startTimestamp: browsingTimestamp,
  }
  const kind = activity('kind')
  const mode = MODES[activity('mode') ?? ''] ?? 'Gungi'

  if (kind === 'game') {
    const status = activity('status')
    const white = activity('white') || 'Anonymous'
    const black = activity('black') || 'Anonymous'
    const kindOfGame = activity('correspondence') === 'true' ? 'Correspondence' : activity('rated') === 'true' ? 'Rated' : 'Casual'
    const label = `${mode} · ${kindOfGame}`
    if (status === 'started' && activity('role') === 'player') {
      const opponent = activity(activity('color') === 'white' ? 'black' : 'white')
      presenceData.details = `Playing ${label}`
      presenceData.state = privacy ? 'In a game' : `vs ${opponent || 'an anonymous player'}`
      presenceData.smallImageKey = Assets.Play
      presenceData.startTimestamp = since(`${pathname} ${white} ${black}`)
    }
    else if (status === 'started') {
      presenceData.details = `Watching ${label}`
      presenceData.state = privacy ? 'A live game' : `${white} vs ${black}`
      presenceData.smallImageKey = Assets.Viewing
      presenceData.startTimestamp = since(`${pathname} ${white} ${black}`)
    }
    else {
      presenceData.details = 'Reviewing a game'
      presenceData.state = privacy ? label : `${white} vs ${black}`
      presenceData.smallImageKey = Assets.Reading
    }
    if (showButtons && !privacy)
      presenceData.buttons = [{ label: status === 'started' ? 'Watch the game' : 'View the game', url: href }]
  }
  else if (kind === 'computer') {
    const level = activity('level')
    presenceData.details = activity('status') === 'ended' ? 'Finished a game against the computer' : 'Playing the computer'
    presenceData.state = `${mode} · Level ${level}`
    presenceData.smallImageKey = Assets.Play
    presenceData.startTimestamp = since(`computer:${mode}:${level}:${activity('color')}`)
  }
  else {
    const page = PAGES.find(([address]) => address.test(pathname))
    presenceData.details = page?.[1] ?? 'Browsing'
    presenceData.state = page?.[2] ?? 'ligungi.org'
  }

  presence.setActivity(presenceData)
})
