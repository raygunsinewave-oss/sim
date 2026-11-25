# DJSIM by Raygun — Master Build Prompt

> Copy everything below this line into your AI coding tool, or hand it to a dev team as the product spec.

---

## 0. Role and mission

You are a senior real-time graphics engineer, audio DSP engineer, game-AI designer and macOS app developer working as one team. Build **DJSIM by Raygun**: a desktop music visualizer that listens to a live DJ set and turns it into a living 3D club or festival. On screen there is a stage, a DJ, an LED wall, lasers, moving-head lights, strobes, haze, pyro, and a crowd of hundreds of individually simulated people who hear the music, recognize their favourite songs, and react the way real people at a real show do.

The app must feel like a AAA game's "live show" mode, not a screensaver. Every frame should look like a photo someone would post from the best night of their life.

Ship it as a downloadable macOS app (`.dmg`, Apple Silicon + Intel) published automatically to GitHub Releases at `https://github.com/raygunsinewave-oss/sim`. Do not stop until a user can download and run the macOS build from that repository's Releases page.

---

## 1. Product identity

| Item | Requirement |
|---|---|
| App name | **DJSIM** (window title and About panel: "DJSIM by Raygun") |
| Developer | Raygun |
| Bundle ID | `com.raygun.djsim` |
| App icon | **A DJ deck**: a top-down turntable/CDJ with vinyl, tonearm, pitch fader and glowing cue/play buttons, inside a macOS rounded-square tile with a cyan-to-magenta neon rim. The vinyl label reads "DJSIM" with "RAYGUN" underneath. Render from SVG to 1024×1024 PNG and to `.icns` with every size from 16 to 1024. |
| Look | Dark UI, glass panels, neon cyan (#00F0FF) and magenta (#FF2BD6) accents, bold condensed headings, tiny monospace readouts. |
| Splash | Black screen, the deck icon spins up like a record, the "DJSIM" wordmark strobes in on a kick drum sample, then "by Raygun". |

---

## 2. Platform and architecture

- **Shell:** Electron (current stable) for macOS 12+, universal coverage via separate arm64 and x64 builds. Use a custom privileged `app://` protocol so ES modules, `fetch` and `getUserMedia` work in a secure context.
- **Renderer:** Three.js (WebGL2) with post-processing (bloom, afterimage trails, film grain, optional glitch, chromatic aberration). Target 60 fps at 1080p on an M1 MacBook Air with 600 crowd members. Scale up to 2,000+ on faster machines.
- **Audio:** Web Audio API. All analysis runs on the main thread from an `AnalyserNode`, or in an `AudioWorklet` if that is cheaper.
- **Packaging:** `electron-builder` → `.dmg` + `.zip` for `arm64` and `x64`, ad-hoc code-signed in an `afterPack` hook so Apple Silicon will launch it. `Info.plist` must include `NSMicrophoneUsageDescription` and `NSAudioCaptureUsageDescription`.
- **CI/CD:** GitHub Actions workflow on hosted macOS runners (`macos-15-intel` and `macos-latest` in parallel) that installs, packages, uploads artifacts, and creates/updates GitHub Release `v<version>` with the `.dmg` and `.zip` files attached. It runs on every push to `main`.
- **Code layout:** `main.js` (Electron), `preload.js` (safe bridge), `src/index.html`, `src/styles.css`, and `src/js/` modules: `audio`, `analysis`, `demo`, `songs`, `personas`, `crowd`, `environments`, `lights`, `lasers`, `visualizers`, `effects`, `dj`, `camera`, `presets`, `ui`, `app`. Three.js is vendored under `src/vendor/` so the app runs fully offline.

---

## 3. Audio input — "it reacts to DJ sets"

Support every way a DJ set might reach the app:

1. **Live input:** any Core Audio input device (DJ mixer booth/record out → audio interface, built-in mic in the room, or a loopback driver like BlackHole/Loopback). There is a device picker and an input gain trim, and the app asks for macOS microphone permission properly.
2. **System audio (experimental):** capture Mac output through screen-capture loopback where the OS allows it, with a clear fallback message recommending BlackHole.
3. **Files / playlist:** drag and drop MP3/WAV/AAC/FLAC/M4A, or ⌘O. There is a playlist with two virtual decks (A/B) and an **auto-mix** that equal-power crossfades over 8–16 bars, like a DJ would. It shows track title/artist from ID3 tags, falling back to the filename.
4. **Built-in Demo DJ:** a procedural Web Audio set (kick, clap, hats, rolling bass, supersaw stabs, risers, snare rolls, drops) that runs through intro → groove → breakdown → build-up → DROP → outro, and moves through genres (house 124, techno 132, trance 138, dubstep 140 half-time, drum & bass 174, hardstyle 150, hip-hop 92). The app is fully demo-able with no music loaded.

### 3.1 Analysis features (computed every frame, smoothed)

- 7-band energy: sub, bass, low-mid, mid, high-mid, presence, air
- RMS loudness, peak, crest factor, and a long-term loudness reference with adaptive gain so quiet and loud sources both look good
- **Onset / beat detection:** spectral flux with adaptive threshold, kick-specific low-band detector, snare/clap detector (mid noise burst), hi-hat detector (air band)
- **Tempo (BPM)** via autocorrelation of the onset envelope (range 70–180, with half/double-time disambiguation), beat phase, bar phase (4/4), and a 32-beat **phrase counter**
- **Spectral centroid, flatness, rolloff** → "brightness" and "noisiness"
- **Section state machine:** `INTRO`, `GROOVE`, `BREAKDOWN`, `BUILDUP`, `DROP`, `OUTRO`. Detect build-ups (rising high-frequency energy plus snare-roll density plus falling bass), breakdowns (bass collapse), and **drops** (bass and kick return after a build-up or a bass gap of 1 bar or more). A drop fires a global `drop` event with an intensity of 0–1.
- **Genre classifier** (heuristic, explainable): BPM band + bass/treble balance + half-time feel + onset density → House, Tech House, Techno, Trance, Dubstep, Drum & Bass, Hardstyle, Hip-Hop/Trap, Pop/EDM, Disco/Funk, Ambient. It shows confidence and smooths over ~8 seconds so it doesn't flicker.
- **Energy level 0–10**, a "hype" meter, and a crowd-wide "vibe" value that integrates over time. Long sets build a "night arc": people get tired, then catch a second wind on a big tune.

---

## 4. Song recognition — "the crowd reacts to different popular songs"

- Ship a built-in **anthem library** of 60+ widely known dance, festival and club tracks (title + artist + genre + "reaction signature": sing-along, hands-up, jump, phone-lights, mosh, couple-dance, chant, crouch-and-jump). Store metadata only: no lyrics, no audio.
- Match the current track via ID3 title/artist or filename (fuzzy, case/punctuation-insensitive, "feat." stripped, remix tags parsed). When a known anthem starts:
  - A ripple of recognition spreads outward from the front rows over 2–4 seconds. Not everyone reacts at once: superfans scream instantly, casuals turn to their friends, a few people don't know it.
  - The LED wall flashes the track title. People who list it as **"their song"** get a personal moment (grab a friend, jump on shoulders, start filming, cry, point at the DJ).
  - The anthem's reaction signature drives the crowd's group behaviour for that track.
- For unknown tracks, reactions come from detected genre, energy, section and the individual tastes of each person.
- Optional (stretch goal, behind a toggle): audio fingerprinting through a user-supplied recognition API key. If you implement it, request no lyrics or copyrighted content.

---

## 5. The crowd — every person has their own story

### 5.1 Scale and rendering

- 200–2,500 people, user-adjustable, with level-of-detail: full articulation near the camera, simplified bodies mid-distance, billboard/impostor silhouettes at the back.
- Bodies are built from instanced parts (pelvis, torso, head, hair, upper/lower arms, upper/lower legs, plus optional props) with a procedural skeleton, so thousands of unique poses can be drawn in a few draw calls.
- **Diversity:** height 1.50–2.00 m, body build (slim/average/broad/heavy), shoulder width, skin tones across the full human range, hair styles (buzz, short, long, ponytail, afro, bun, braids, mohawk, bald) and hair colours (natural plus pastel/neon festival dye), outfits (tees, tanks, hoodies, mesh, sequins, fluorescent festival wear, all-black techno uniform), and accessories (caps, bucket hats, cowboy hats, glowsticks, LED gloves, phones, drinks, flags, totems, glasses, kandi, wheelchairs on accessible platforms).

### 5.2 Personas (procedurally generated, deterministic per seed)

Each person has:

- **Name, age (18–65), hometown**, and an **archetype**: Superfan, Raver Veteran, First-Timer, Techno Purist, Festival Bestie Squad, Couple on a Date, Birthday Group, Bachelorette, Tourist, Industry Insider, Dance-Battle King/Queen, Shuffler, Headbanger, Wallflower, Phone Filmer, Influencer, Off-Duty DJ, Bartender on Break, Security-Adjacent Lurker, Sober Raver, Older Cool Parent, Gym Bro, Goth/Industrial, K-Pop Stan Who Got Dragged Along, Dancer from a Crew.
- **Backstory** (1–2 sentences assembled from grammar templates, e.g. "Drove six hours from Tucson after selling her car to pay for the ticket. Swore she'd stay until the last song.")
- **Motivation / goal for the night** (see the headliner, find their lost friend, propose, get on the barrier, win a dance circle, forget a bad week, record content, make a new friend)
- **Music taste vector** across genres, plus 1–3 **"their song"** anthems from the library
- **Friend group** (2–8 people) who stay physically near each other, face each other between drops, and react together
- **Personality traits** (0–1): extraversion, rhythm skill, stamina, hype susceptibility, phone addiction, chill, rowdiness
- **Live state:** energy, stamina, hydration, mood (bored → content → happy → euphoric), current behaviour, attention target (DJ, friend, phone, lasers, bar)
- **Story log:** timestamped events they generate during the night ("21:47 — Lost Jess near the sound desk." "21:52 — Heard 'their song'. Screamed." "22:10 — Got on Marcus's shoulders for the drop.")

### 5.3 Behaviour system

Use a utility-AI / behaviour-tree hybrid evaluated at 5–10 Hz per person (staggered), with animation at full frame rate.

**Dance styles** (procedural, beat-synced, blended by taste, genre and energy; each with per-person timing offset, amplitude, sloppiness and personal flair):

bounce · fist-pump · hands-up wave · jump (on drops) · pogo · headbang · two-step · house groove (torso jack) · shuffle / running man · hardstyle stomp · DnB skank · dubstep half-time head-nod and "stank face" lean · trance hands-to-sky · hip-hop bop and arm swings · disco point · sway with eyes closed · glowstick twirl · clap on 2 and 4 · couple dance · crouch-and-jump on the drop (whole crowd crouches during the build, explodes on the drop) · mosh circle (crowd opens a ring during build-ups for heavy genres) · crowd surfing · sitting on shoulders · filming with phone (screen glow) · sing-along with arm pointing at the DJ · chatting with friends between tracks · walking to the bar / toilets and back · catching a breather at the edge · hugging friends at the climax.

**Crowd-level dynamics:**

- Section-aware: low motion in intros, heads-down groove in grooves, arms rising and anticipation during build-ups (density compresses toward the stage), synchronized explosion on DROP, relaxed swaying and lighters/phone-lights in breakdowns.
- Contagion: excitement spreads from neighbour to neighbour, with superfans and dancers as "seeds".
- Spatial realism: dense near the barrier, looser at the back, flow paths to the bar and exits, nobody walks through each other (simple separation steering on a grid).
- Fatigue and second wind: a 2-hour set should visibly change the crowd; some people leave, new people arrive.
- No two people move identically. Even in perfect sync moments, offsets of 20–80 ms, differing amplitudes and individual flourishes keep it organic.

### 5.4 Inspecting people

- Click any person to open their **Story Card**: name, age, hometown, archetype, backstory, goal, favourite genres, "their song", friends (clickable), live mood/energy/stamina meters, and a scrolling story log.
- **Follow cam:** the camera eases to an over-the-shoulder view of that person and stays with them.
- "Random Story" button jumps to someone mid-moment.
- A ticker at the bottom of the screen surfaces the best live moments ("Priya just got on her girlfriend's shoulders for the drop").

---

## 6. The DJ and the stage

- A 3D DJ behind a booth with two CDJs/turntables and a mixer. Hands animate: riding faders and EQ knobs during builds, a fist in the air on drops, head-nodding on the beat, pointing at the crowd, occasionally waving a towel.
- Booth materials react: jog wheels and mixer meters glow with the audio.
- Optional MC text: type a shout-out and it appears on the LED wall.

---

## 7. Lights, lasers, LED walls and FX — interactive and eye-catching

### 7.1 Lighting rig

- **Moving heads** (spot/beam/wash) mounted on truss, with volumetric cone beams in additive blending through haze. Movement patterns: sweep, fan, ballyhoo, circle, figure-8, crowd-scan, point-at-DJ, chaos, and all-to-center on drops. Patterns sync to bar phase. Colours come from the active palette with per-section transitions.
- **Strobes and blinders:** strobe rate follows onsets in build-ups, blinders flash white into the crowd on drops, and there's a dedicated "strobe hold" button.
- **Wash/par lights** on the stage and audience with colour chases.
- **Uplights** on the architecture (pillars, walls, trees, rock, ice).

### 7.2 Lasers

- Multiple laser projectors with modes: fan sweep, tunnel/cone, liquid-sky sheet over the crowd, crossing beams, scanning grid, spiral, wave, random "chaos", and beat-chase. Lasers draw as thin, bright additive beams that bloom, scattered by haze.
- Colour modes: single, RGB, palette-cycle, rainbow.
- Intensity is gated by section. Lasers are minimal in the intro and go full blast on drops.

### 7.3 LED wall / visualizer shaders (12+ modes, all audio-reactive)

Spectrum bars · circular spectrum · oscilloscope waveform · tunnel · kaleidoscope · plasma · starfield warp · VU grid / equalizer matrix · glitch typography ("DJSIM", track title, MC text) · Voronoi cells · Rings / ripples · Sunset retro grid · Fractal flame-ish feedback. Every mode reads a 512-bin FFT texture, the waveform texture, beat/bar phase, energy, and the palette. Auto-switch on phrase boundaries in VJ mode.

### 7.4 Special effects

- Haze/fog volume with a density slider
- CO2 cryo jets on drops
- Pyro flame columns (stadium/festival)
- Confetti and streamer cannons
- Sparklers / waterfall
- Fireworks above open-air stages
- Bubbles, snow, rain and sand depending on environment
- Crowd phone-light "galaxy" in breakdowns

### 7.5 Post-processing

Unreal bloom (strength keyed to energy), afterimage trails (subtle, more on drops), film grain + vignette, optional glitch on drops, exposure punch on kick.

### 7.6 Interactivity

- **Mouse:** orbit/pan/zoom; click the LED wall to cycle visuals; click a laser bank to change its pattern; click a person to open their story; double-click the stage for a manual drop.
- **Keyboard:** `Space` trigger drop · `S` strobe (hold) · `L` lasers on/off · `P` pyro · `C` confetti · `F` fog · `B` blinders · `V` next visual · `K` next laser mode · `E` next environment · `1–9` presets · `Tab` hide UI · `H` help · `R` random story · `G` follow cam · `0` cinematic auto-cam.
- **MIDI (stretch):** map any controller knob/pad to FX triggers.

---

## 8. Environments (20+, each with its own geometry, lighting, palette, weather and crowd density)

1. **Warehouse Rave:** brick walls, steel trusses, a single red-white rig, low ceiling haze
2. **Mainstage Festival:** giant LED wall wings, pyro, CO2, fireworks, 2,000-strong crowd, night sky
3. **Techno Bunker:** concrete, minimal white strobes, red lasers, all-black crowd
4. **Ibiza Sunset Beach Club:** ocean, palm trees, golden hour fading to night, pool deck
5. **Neo-Tokyo Rooftop:** skyline, neon signs, rain on the floor reflecting lights
6. **Basement Boiler Room:** DJ in the middle, crowd 360° around, handheld camera feel
7. **Desert Playa Sunrise:** art cars, dust, giant sculptures, dawn sky
8. **Cyber Neon Club:** chrome, grid floor, cyan/magenta everything
9. **Ice Cave:** blue crystalline walls, frozen stalactites, snow particles
10. **Jungle Temple:** stone ziggurat stage, vines, torches, fireflies
11. **Orbital Space Station:** Earth through the window, zero-g confetti, stars
12. **Stadium Night:** tiered stands, massive line arrays, fireworks
13. **Gothic Cathedral Rave:** stained-glass light, pillars, organ-pipe LED wall
14. **Forest Clearing:** trees with uplights, moon, mist
15. **Superyacht Party:** deck, sea, distant city lights
16. **Retro 80s Synthwave:** sun grid horizon, palm silhouettes, chrome text
17. **Underwater Dome:** caustics, fish schools, bioluminescence
18. **Volcano Crater:** lava glow, ash particles, red/orange palette
19. **Northern Lights Tundra:** aurora sky, snow, igloo stage
20. **Rainy Underpass:** puddles, graffiti, sodium lights, guerilla sound system
21. **Sky Arena:** floating platforms above clouds at sunset

Each environment defines: venue geometry, sky/backdrop, fog colour/density, floor material, stage style, truss layout, light/laser counts and positions, LED wall size and shape, palette(s), ambient particles, default crowd size and density shape, and preferred camera shots.

---

## 9. Presets and customization

- **40+ presets** combining environment + visualizer + laser mode + light pattern + palette + FX intensity + camera mode + post-FX (for example "Bunker Hypnosis", "Festival Fireworks Finale", "Sunset Deep House", "Tokyo Rain DnB", "Cathedral Trance", "Desert Dawn", "Glitch Cyber", "Ice Melt Dubstep").
- **Palettes (15+):** Neon Night, Sunset, Ice, Toxic, Lava, Ultraviolet, Mono White, Red Alert, Ocean, Rainbow, Pastel, Gold, Forest, Aurora, Cyberpunk.
- **Auto-VJ mode:** the app becomes its own lighting designer. It changes visual/laser/palette on phrase boundaries, saves the biggest looks for drops, and occasionally switches environment between tracks.
- **Custom presets:** save/load the current look to local storage, export/import JSON.
- **Settings:** crowd size, quality tier (Low/Medium/High/Ultra), bloom, trails, grain, fog, FX intensity, beat sensitivity, input gain, latency offset (−200 to +200 ms) so the visuals line up with the speakers.

---

## 10. Cameras

Free orbit · DJ POV (over the decks, looking at the crowd) · Front-row POV · Crowd POV (first person, bobbing to the beat) · Drone fly-over · Balcony wide · Follow person · **Cinematic auto-director** that cuts between shots on bar boundaries, does slow push-ins during build-ups and a fast whip to a wide crowd shot on the drop.

---

## 11. UI / UX

- Top bar: DJSIM wordmark, source selector (Demo / Files / Live Input / System Audio), now-playing title, BPM, detected genre, section badge, energy meter.
- Left drawer: Environments (thumbnail grid), Presets, Palettes.
- Right drawer: Visuals (LED mode, lasers, lights, FX sliders), Crowd (size, stories, ticker), Settings.
- Bottom: deck strip with transport for playlist mode (play/pause/next, auto-mix toggle, crossfader), plus the live moment ticker.
- `Tab` hides everything for a clean full-screen show. Everything is keyboard accessible, and there's a help overlay with all shortcuts.
- First-run onboarding: 3 tooltip steps (pick a source → pick a world → click a person).

---

## 12. Performance budget

- ≤ 25 draw calls for the crowd (instancing), ≤ 8 ms CPU per frame for simulation at 600 people (behaviour updates staggered, animation analytic)
- Pre-allocate everything and do no per-frame garbage
- Quality tiers adjust pixel ratio, bloom resolution, crowd LOD distances and particle counts
- Auto-quality: if fps < 45 for 3 seconds, drop a tier and show a toast

---

## 13. Acceptance criteria

1. Launching the app with no input plays the Demo DJ, and within 5 seconds the crowd is dancing in time and lights are moving.
2. The crowd visibly crouches during a build-up and jumps on the drop, with staggered timing.
3. Clicking any person shows a unique name, backstory, goal and live story log that grows over time.
4. Loading a file whose title matches a library anthem triggers a visible recognition wave and a title flash.
5. At least 20 environments and 40 presets are selectable, and each looks distinctly different.
6. Lasers, moving heads, strobes, LED wall and FX respond to the music and to keyboard/mouse triggers.
7. Live input from a selected audio device drives everything after macOS permission is granted.
8. The GitHub Actions workflow produces `DJSIM-<version>-arm64.dmg` and `DJSIM-<version>-x64.dmg` attached to a Release in `raygunsinewave-oss/sim`, with the DJ-deck icon showing in Finder and the Dock.

---

## 14. Deliverables

- Full source in the repo, a README with install and Gatekeeper instructions ("right-click → Open" or `xattr -cr /Applications/DJSIM.app` for unsigned builds), and a keyboard shortcut table
- The `.github/workflows/build-macos.yml` pipeline
- Release notes listing environments, presets and features
- Keep going until the Release download link works.
