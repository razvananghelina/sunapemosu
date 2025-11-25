# Ghid pentru Video-uri

Acest folder trebuie să conțină video-urile cu Moșul Crăciun.

## Sistem de Tranziții

**IMPORTANT:** Fiecare video trebuie să aibă ultimul frame identic sau foarte asemănător cu primul frame al video-ului următor, pentru tranziții fluide.

### Exemplu:
- `intro.mp4` - ultimul frame → primul frame al `listening.mp4`
- `listening.mp4` - ultimul frame (loop) → primul frame al `speaking.mp4`
- `speaking.mp4` - ultimul frame → primul frame al `listening.mp4`

## Structură Video-uri

### Video-uri Esențiale (pentru început):
1. **intro.mp4** - Video de introducere
   - Dimensiune: 464x688px
   - Loop: NU
   - Se afișează după ecranul "Se apelează..."
   - Durata: 3-5 secunde
   - Tranziție: Ultimul frame = primul frame din listening.mp4

2. **listening.mp4** - Moșul ascultă
   - Dimensiune: 464x688px
   - Loop: DA
   - Se repetă continuu cât timp așteaptă input
   - Ultimul frame = primul frame (pentru loop smooth)
   - Durata recomandată: 3-5 secunde

### Video-uri pentru Conversație (opționale):
- `speaking.mp4` - Moșul vorbește normal (loop)
- `speaking_happy.mp4` - Moșul vorbește fericit (loop)
- `speaking_surprised.mp4` - Moșul vorbește surprins (loop)
- `thinking.mp4` - Moșul se gândește (loop)
- `transition_to_listening.mp4` - Tranziție de la speaking la listening (no loop)

## Specificații Tehnice

- **Dimensiune video**: 464x688px (aspect ratio 464:688)
- **Format**: MP4 (H.264 codec recomandat)
- **Calitate**: Medium-High (pentru balance între calitate și dimensiune)
- **FPS**: 24-30 fps
- **Audio**: Fără audio (audio-ul vine separat de la Eleven Labs)

## Note Importante

1. **Video-uri Loop**: Pentru video-urile care se repetă (listening, speaking, etc.), asigură-te că prima și ultima cadru se potrivesc pentru un loop smooth.
2. **Optimizare**: Comprimă video-urile pentru a reduce timpul de încărcare.
3. **Placeholder**: Până când ai video-urile, aplicația va folosi un emoji de Moș Crăciun.

## Cum să Testezi

După ce adaugi `intro.mp4`:
1. Pornește aplicația (npm run dev)
2. Apasă butonul verde "Sună Moșul"
3. Ar trebui să vezi poza Moșului + text "Se apelează... Moș Crăciun"
4. După 2 secunde, ar trebui să înceapă video-ul intro.mp4
5. După terminarea video-ului, începe conversația
