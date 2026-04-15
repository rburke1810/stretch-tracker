// StretchTracker — Stretch Data
// To update with prescribed leg stretches: replace the legs array entries below.
// Each stretch needs: id, name, category, instructions, muscles

const STRETCHES = [
  // ===== Carpal Tunnel Stretches =====
  {
    id: 'ct-1',
    name: 'Wrist Flexor Stretch',
    category: 'carpal',
    instructions: 'Extend one arm straight out, palm facing up. Use your other hand to gently pull the fingers back toward your body. Hold, then switch sides. Keep elbow straight.',
    muscles: 'Forearm flexors'
  },
  {
    id: 'ct-2',
    name: 'Wrist Extensor Stretch',
    category: 'carpal',
    instructions: 'Extend one arm out, palm facing down with fingers curled. Use your other hand to gently pull your hand downward toward the floor. Hold, then switch sides.',
    muscles: 'Forearm extensors'
  },
  {
    id: 'ct-3',
    name: 'Median Nerve Glide',
    category: 'carpal',
    instructions: 'Extend one arm straight out to your side, palm facing up. Slowly tilt your head away from that arm while pointing fingers down toward the floor. Return and repeat 5 times, then switch sides.',
    muscles: 'Median nerve'
  },
  {
    id: 'ct-4',
    name: 'Tendon Glides',
    category: 'carpal',
    instructions: 'Start with fingers fully straight. Progress through each position slowly: hook fist (fingertips to palm base), full fist, tabletop (fingers flat, knuckles bent), then back to straight. 5 reps per hand.',
    muscles: 'Finger flexor tendons'
  },
  {
    id: 'ct-5',
    name: 'Prayer Stretch',
    category: 'carpal',
    instructions: 'Press palms together in front of your chest, fingers pointing up. Slowly lower joined hands toward your waist until you feel a stretch in your wrists and forearms. Hold.',
    muscles: 'Wrist flexors'
  },
  {
    id: 'ct-6',
    name: 'Thumb Stretch',
    category: 'carpal',
    instructions: 'Hold one hand out in front of you, palm facing up. Use your other hand to gently pull your thumb back toward your wrist until you feel a stretch at the base of the thumb. Hold, then switch hands.',
    muscles: 'Thenar muscles, Thumb ligaments'
  },

  // ===== Leg & Feet Stretches =====
  // NOTE: Replace these with your prescribed stretches.
  // Keep the same data structure: id, name, category, instructions, muscles.
  {
    id: 'leg-1',
    name: 'Standing Quad Stretch',
    category: 'legs',
    instructions: 'Stand on one foot and pull the opposite heel toward your glute. Keep your knees together and stand tall. Use a wall for balance if needed. Hold, then switch sides.',
    muscles: 'Quadriceps'
  },
  {
    id: 'leg-2',
    name: 'Calf Raise Hold',
    category: 'legs',
    instructions: 'Rise onto your tiptoes as high as possible and hold at the top. Lower slowly. For more intensity, do one foot at a time. Focus on the full range of motion.',
    muscles: 'Gastrocnemius, Soleus'
  },
  {
    id: 'leg-3',
    name: 'Doorway Calf Stretch',
    category: 'legs',
    instructions: 'Place the ball of one foot against a wall or step edge with your heel on the floor. Lean your body forward gently until you feel a deep calf stretch. Hold, then switch sides.',
    muscles: 'Gastrocnemius'
  },
  {
    id: 'leg-4',
    name: 'Seated Hamstring Stretch',
    category: 'legs',
    instructions: 'Sit on the edge of a chair. Extend one leg straight with your heel on the floor. Sit tall and slowly hinge forward from your hips — not your waist — until you feel the stretch. Hold, then switch sides.',
    muscles: 'Hamstrings'
  },
  {
    id: 'leg-5',
    name: 'Figure-Four Hip Stretch',
    category: 'legs',
    instructions: 'Sit in a chair. Cross one ankle over the opposite knee to create a figure-4 shape. Sit tall and gently press down on the raised knee. Hold, then switch sides.',
    muscles: 'Piriformis, Glutes'
  },
  {
    id: 'leg-6',
    name: 'Ankle Alphabet',
    category: 'legs',
    instructions: 'Lift one foot off the floor. Trace every letter of the alphabet — A through Z — slowly with your toes. Keep movements smooth and controlled. Switch feet halfway through.',
    muscles: 'Ankle stabilizers'
  },
  {
    id: 'leg-7',
    name: 'Toe Spread & Scrunch',
    category: 'legs',
    instructions: 'Lift both feet slightly. Spread your toes as wide as possible and hold for 3 seconds, then curl them firmly under. Do 8 slow reps. Try to move each toe independently.',
    muscles: 'Intrinsic foot muscles'
  },
  {
    id: 'leg-8',
    name: 'Hip Flexor Lunge',
    category: 'legs',
    instructions: 'Step one foot forward into a lunge position. Keep your back leg extended and push your hips gently forward until you feel a stretch in the front of your back hip. Hold, then switch sides.',
    muscles: 'Iliopsoas, Hip flexors'
  },
  {
    id: 'leg-9',
    name: 'Seated Shin Stretch',
    category: 'legs',
    instructions: 'Sit in a chair and extend one leg slightly. Point your toes away from you and hold. For a deeper stretch, press the top of your foot gently toward the floor. Hold, then switch sides.',
    muscles: 'Tibialis anterior'
  },
  {
    id: 'leg-10',
    name: 'Lateral Calf Rock',
    category: 'legs',
    instructions: 'Stand with feet slightly wider than shoulder width. Slowly rock your weight to the outer edges of both feet and hold briefly, then return to center. Do 8 slow, controlled reps.',
    muscles: 'Peroneals, Lateral ankle'
  }
]
