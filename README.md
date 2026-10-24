# Squid Dare

Halloween office game, Squid Game themed. A slot reel picks a player, Young-hee
turns her back while they answer (green light), and turns round when time runs
out (red light). Fail, and the penalty reel picks your dare.

Internal use only.

## Run

    npm install
    npm run dev

Static site, no backend: lists live in the browser's localStorage, and a
`.md` upload is read locally with FileReader.

## Controls

| Key   | When            | Does                         |
|-------|-----------------|------------------------------|
| Space | pick            | spin the name reel           |
| A / F | question        | answered / failed            |
| R     | question        | reveal the answer (host)     |
| Space | after a verdict | next player                  |

Click the logo to go back to the lobby (the game resumes where it left off).

## Lists (.md)

    # Players
    - Full Name

    # Questions
    - Question? | answer for the host

    # Dares
    - Eat one extra-sour candy

A file with no headings is read as a list of names. List names only: the game
gives every player their own number. `<!-- comments -->` are ignored.

**Generate it with AI:** the template (Player files → download icon) starts with
a ready prompt in a comment. Paste it into any AI with your team's names; it asks
for short, sayable answers (Hard mode matches word for word) and office-safe dares.

## Voice (Chrome)

- **The announcer calls numbers only**: "Player zero six three." when a player is
  picked, then "…, eliminated." or "…, passed." Questions and penalties are read
  off the screen. Numbers are unique per player list.
- **Fish Audio voice (optional)**: the announcer is 13 words strung together
  ("player", "zero"–"nine", "eliminated", "passed"), so it works for any list.
  In Fish's Text To Speech page, generate this in one take (one word per line)
  and download it:

      Player. Zero. One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Eliminated. Passed.

  then cut it at the pauses into `public/voice/parts/` (needs ffmpeg):

      node tools/split_voice.mjs ~/Downloads/take.mp3

  Without the clips, Chrome's voice reads the lines.

- **Players answer out loud** (Web Speech recognition, `en-IN`): the mic opens
  a moment after the question appears, the transcript shows live, and hearing
  the answer stops the clock and passes the player. Chrome sends the mic audio
  to Google's speech service.
- **Hard mode** (default, toggle on the card): players can talk until the clock
  runs out, and only the **last** thing they said is judged, word for word.
  Right answer then "no wait…" = shot.
- **Red light, green light**: while the clock runs, the doll sings with her
  back turned (green: answer now), then turns round (red: silence). Any new
  word at red light eliminates on the spot. The song speed and the red light's
  length (2–5 s) are random, so nobody can count her turn.
- **Time's up**: when the clock runs out a shoot bar drains for 4 s; the host can
  press A to spare the player, otherwise the guard fires.
- The host's A / F keys always override, for noise or odd answers.
- `Voice` / `Mic` toggles sit top-right in the game.

Answers match loosely: case, punctuation, "the/a", "3" vs "three" and small
misspellings are ignored; text in (brackets) is a note, not required. List
alternatives with ` / `:

    - Who wrote Frankenstein? | Mary Shelley / Shelley

## Fair draw

`src/game/pcg.js` is PCG32 (PCG-XSH-RR, pcg-random.org), checked against the
reference output. Each game gets a 64-bit seed from `crypto.getRandomValues`,
shown bottom-left. Names, questions and dares use separate PCG streams, each
order is a Fisher–Yates shuffle with unbiased bounded draws, and nobody is
called twice. Enter the same seed in the lobby with the same lists to replay
a game exactly.

## Assets

- `public/models/doll.glb` — "Squid Game Doll Rig" by Bug All, CC-BY (Sketchfab), compressed with gltf-transform.
- `public/textures/ground_*.jpg` — "Baseball Playground" from Poly Haven, CC0 (1k colour and normal maps).
- `public/models/arena.glb` — "Squid Game: Red Light Green Light" by DodoBabypop, CC BY-NC-ND 4.0 (Sketchfab), non-commercial use only. Textures shrunk to webp (`gltf-transform optimize`); its doll, tree and ground are hidden in `src/scene/Arena.jsx`. Original in `assets-src/arena/`.
- `public/models/guard.glb` — "Squid Game Pink Soldier" by Protyanik25, CC-BY (Sketchfab). Rigged, given a rifle and a
  shooting clip by `tools/rig_guard.py` (Blender, headless), then compressed:
  ```
  blender -b --python tools/rig_guard.py -- assets-src/squid_game_pink_soldier.glb assets-src/guard_rigged.glb
  npx @gltf-transform/cli optimize assets-src/guard_rigged.glb public/models/guard.glb \
    --texture-compress webp --compress meshopt --simplify false --join false --flatten false --prune false
  ```
  (`--prune false` keeps the empty "Muzzle" node the flash is placed on.)
- `public/audio/intro.mp3` (the invitation card and lobby), `lobby.mp3` (the spin, a merry-go-round tune), `redlight.mp3` (the doll's chant), `dare.mp3` (under a dare, e.g. "Pink Soldiers") — optional music; add your own.
- `public/fonts/GameOfSquids.ttf` — optional title font (FontSpace, freeware); falls back to Bebas Neue.

## Layout

    src/game    pcg.js (draws), data.js (lists, .md parsing), useGame.js (phases)
    src/scene   Stage (camera, lights), Field (arena), Doll (head turn)
    src/ui      Lobby (business card), FlapBoard (name board), Panels (HUD, question, O/X, penalty card, end)
    src/audio   sound.js (synth SFX + music tracks)
