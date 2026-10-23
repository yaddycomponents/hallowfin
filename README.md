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

A file with no headings is read as a list of names.

## Voice (Chrome)

- **The doll speaks** (speechSynthesis): calls each player, reads the question,
  announces "passed" / "eliminated" and the penalty.
- **Players answer out loud** (Web Speech recognition, `en-IN`): the mic opens
  when she finishes reading, the transcript shows live, and hearing the answer
  stops the clock and passes the player. Chrome sends the mic audio to
  Google's speech service.
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
- `public/audio/lobby.mp3`, `public/audio/redlight.mp3` — optional music; add your own.
- `public/fonts/GameOfSquids.ttf` — optional title font (FontSpace, freeware); falls back to Bebas Neue.

## Layout

    src/game    pcg.js (draws), data.js (lists, .md parsing), useGame.js (phases)
    src/scene   Stage (camera, lights), Field (arena), Doll (head turn)
    src/ui      Lobby, Reel, Panels (HUD, question, stamps, penalty, end)
    src/audio   sound.js (synth SFX + music tracks)
