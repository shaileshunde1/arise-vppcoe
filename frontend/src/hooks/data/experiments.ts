export interface SliderConfig {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  options?: { value: string | number; label: string }[]; // Added options for dropdowns like prism material or flame test metals
}

export interface Experiment {
  id: string;
  title: string;
  subject: 'physics' | 'chemistry';
  ncert: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  description: string;
  aim: string;
  theory: string;
  procedure: string[];
  variables: SliderConfig[];
  apparatus: string[];
  safetyNotes: string[];
  chartType: 'line' | 'scatter' | 'bar';
  chartLabel: { x: string; y: string; title: string };
  scoring: { completion: number; accuracy: number; time: number; journal: number };
}

export const experiments: Experiment[] = [
  {
    id: "simple-pendulum",
    title: "Simple Pendulum",
    subject: "physics",
    ncert: "Class 11 Physics, Chapter 14 - Oscillations",
    difficulty: "beginner",
    duration: "20 mins",
    description: "Study the relationship between the length of a simple pendulum and its time period to calculate g.",
    aim: "To study the relationship between the length of a simple pendulum and its time period, and to calculate the value of g.",
    theory: "For small oscillations, the time period T of a simple pendulum is given by T = 2π√(L/g), where L is the length of the string and g is the acceleration due to gravity. The period is independent of the mass of the bob.",
    procedure: [
      "Set the length of the pendulum (L) using the slider.",
      "Ensure the mass and angle are set within appropriate ranges (small angle of 5-15°).",
      "Click 'Release' to start the oscillation and observe the timer.",
      "Record the time for 10 oscillations, and use it to find the time period (T).",
      "Repeat for at least 3 length readings.",
      "Plot T² vs L to find the slope which equals 4π²/g."
    ],
    variables: [
      { id: "length", name: "Length", min: 10, max: 150, step: 1, defaultValue: 50, unit: "cm" },
      { id: "mass", name: "Mass of Bob", min: 10, max: 200, step: 1, defaultValue: 50, unit: "g" },
      { id: "angle", name: "Release Angle", min: 5, max: 15, step: 1, defaultValue: 10, unit: "°" }
    ],
    apparatus: ["String", "Bob", "Stand", "Stopwatch", "Ruler"],
    safetyNotes: ["Ensure the bob is securely attached.", "Do not exceed an angle of 15° for accurate simple harmonic motion approximation."],
    chartType: "scatter",
    chartLabel: { x: "Length L (cm)", y: "Time Period T² (s²)", title: "L vs T² Plot" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "ohms-law",
    title: "Ohm's Law",
    subject: "physics",
    ncert: "Class 10 Physics, Chapter 12 - Electricity",
    difficulty: "beginner",
    duration: "15 mins",
    description: "Verify Ohm's Law and study the V-I relationship of a resistor.",
    aim: "To verify Ohm's Law and study the V-I relationship of a resistor.",
    theory: "Ohm's law states that the current (I) flowing through an Ohmic conductor is directly proportional to the potential difference (V) across it, provided temperature remains constant. V = IR, where R is resistance.",
    procedure: [
      "Select a fixed resistance value using the slider.",
      "Turn on the switch to close the circuit.",
      "Gradually increase the voltage from 1V to 12V.",
      "Record the current (I) from the ammeter for each voltage step.",
      "Observe the V-I graph being plotted. A straight line verifies Ohm's law."
    ],
    variables: [
      { id: "voltage", name: "Voltage", min: 1, max: 12, step: 1, defaultValue: 3, unit: "V" },
      { id: "resistance", name: "Resistance", min: 0, max: 100, step: 1, defaultValue: 47, unit: "Ω" }
    ],
    apparatus: ["Battery", "Rheostat", "Ammeter", "Voltmeter", "Resistor", "Switch"],
    safetyNotes: ["Do not short circuit the battery.", "Ensure measuring instruments are connected with correct polarities."],
    chartType: "line",
    chartLabel: { x: "Voltage V (V)", y: "Current I (mA)", title: "V-I Characteristics" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "projectile-motion",
    title: "Projectile Motion",
    subject: "physics",
    ncert: "Class 11 Physics, Chapter 4 - Motion in a Plane",
    difficulty: "intermediate",
    duration: "25 mins",
    description: "Study motion of a projectile and relationship between angle and range.",
    aim: "To study the motion of a projectile and find the relationship between launch angle and range.",
    theory: "A projectile launched with velocity u at angle θ traces a parabola. The horizontal range R is given by R = u²sin(2θ)/g. Maximum range occurs at θ = 45°. The max height H = u²sin²(θ)/(2g).",
    procedure: [
      "Set the launcher to a specific height (h = 0m for basic ground launch).",
      "Set the initial velocity to 15 m/s.",
      "Launch projectiles at 15°, 30°, 45°, 60°, and 75° angles.",
      "For each launch, record the horizontal range and maximum height.",
      "Observe that 45° provides the maximum range on flat terrain."
    ],
    variables: [
      { id: "angle", name: "Launch Angle", min: 0, max: 90, step: 5, defaultValue: 45, unit: "°" },
      { id: "velocity", name: "Initial Velocity", min: 5, max: 30, step: 1, defaultValue: 15, unit: "m/s" },
      { id: "height", name: "Launch Height", min: 0, max: 10, step: 1, defaultValue: 0, unit: "m" }
    ],
    apparatus: ["Projectile Launcher", "Protractor", "Measuring Tape", "Carbon Paper"],
    safetyNotes: ["Stand clear of the trajectory path.", "Use low velocities initially to map the range bounds."],
    chartType: "bar",
    chartLabel: { x: "Angle (°)", y: "Range (m)", title: "Angle vs Range" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "prism-refraction",
    title: "Refraction through a Prism",
    subject: "physics",
    ncert: "Class 12 Physics, Chapter 9 - Ray Optics",
    difficulty: "intermediate",
    duration: "30 mins",
    description: "Find the angle of minimum deviation and refractive index of a prism.",
    aim: "To find the angle of minimum deviation and calculate the refractive index of the prism material.",
    theory: "As a ray of light passes through a prism, it suffers deviation. The deviation angle δ varies with incidence angle i. At minimum deviation (δm), i = e, and the ray inside is parallel to the base. The refractive index μ = sin((A+δm)/2) / sin(A/2).",
    procedure: [
      "Select the prism material from the dropdown menu.",
      "Adjust the incident angle (i) from 30° to 70°.",
      "Observe the animated ray path and the dispersion effect upon exit.",
      "Record the deviation angle (δ) for each step of incident angle.",
      "Identify the angle where deviation is minimum by observing the U-shaped curve.",
      "Use the minimum deviation angle to calculate µ."
    ],
    variables: [
      { id: "angle", name: "Incidence Angle", min: 20, max: 70, step: 1, defaultValue: 45, unit: "°" },
      { id: "material", name: "Material", min: 0, max: 3, step: 1, defaultValue: 0, unit: "idx", options: [
        { value: 1.5, label: "Glass (μ=1.5)" },
        { value: 1.33, label: "Water (μ=1.33)" },
        { value: 1.7, label: "Dense Glass (μ=1.7)" },
        { value: 2.4, label: "Diamond (μ=2.4)" }
      ]}
    ],
    apparatus: ["Glass Prism", "Optical Pins", "Drawing Board", "Protractor", "White Paper"],
    safetyNotes: ["Handle the glass prism carefully to avoid chipping edges.", "Do not look directly into the dispersed bright light beam."],
    chartType: "line",
    chartLabel: { x: "Angle of Incidence (°)", y: "Angle of Deviation (°)", title: "Deviation Curve" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "magnetic-field",
    title: "Magnetic Field Lines",
    subject: "physics",
    ncert: "Class 12 Physics, Chapter 5 - Magnetism and Matter",
    difficulty: "beginner",
    duration: "20 mins",
    description: "Study the pattern of magnetic field lines around a bar magnet.",
    aim: "To study the pattern of magnetic field lines around a bar magnet.",
    theory: "Magnetic field lines originate from the North pole and terminate at the South pole, forming continuous closed loops. They never intersect each other. The tangent to the field line indicates the direction of the magnetic field.",
    procedure: [
      "Set the pole strength of the magnet.",
      "Toggle between a single magnet or two magnets (like/unlike poles).",
      "Observe the flowing field lines generated around the poles.",
      "Drag the compass needle to different points near the magnet.",
      "Notice how the compass aligns itself tangentially to the magnetic field line.",
      "Record field strength values relative to distance."
    ],
    variables: [
      { id: "strength", name: "Pole Strength", min: 1, max: 10, step: 1, defaultValue: 5, unit: "A·m" },
      { id: "mode", name: "Arrangement", min: 0, max: 2, step: 1, defaultValue: 0, unit: "mode", options: [
        { value: 0, label: "Single Magnet" },
        { value: 1, label: "Unlike Poles" },
        { value: 2, label: "Like Poles" }
      ]}
    ],
    apparatus: ["Bar Magnet", "Compass Needle", "Iron Filings", "White Paper"],
    safetyNotes: ["Keep strong magnets away from sensitive electronics."],
    chartType: "bar",
    chartLabel: { x: "Distance from Pole (cm)", y: "Relative Field Strength", title: "Field Strength vs Distance" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "acid-base-titration",
    title: "Acid-Base Titration",
    subject: "chemistry",
    ncert: "Class 11 Chemistry, Chapter 7 - Equilibrium",
    difficulty: "intermediate",
    duration: "30 mins",
    description: "Determine concentration of NaOH solution by titrating against standard HCl.",
    aim: "To determine the concentration of NaOH solution by titrating it against a standard HCl solution using phenolphthalein indicator.",
    theory: "At the equivalence point in a strong acid-strong base titration, moles of acid = moles of base (M1V1 = M2V2). Using phenolphthalein, the pink basic solution turns colorless at the end point.",
    procedure: [
      "Set the molarity of the standard HCl solution.",
      "Set the initial volume of NaOH in the conical flask.",
      "Choose a slow titration speed for better accuracy.",
      "Click 'Open Tap' to start adding HCl drops into the flask.",
      "Watch the color transition closely. Stop when the pale pink turns permanently colorless.",
      "Record the volume of HCl added from the burette."
    ],
    variables: [
      { id: "molarity", name: "HCl Concentration", min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.1, unit: "M" },
      { id: "volumeFlask", name: "NaOH Vol", min: 10, max: 25, step: 1, defaultValue: 20, unit: "mL" },
      { id: "speed", name: "Drip Speed", min: 1, max: 3, step: 1, defaultValue: 2, unit: "spd", options: [
        { value: 1, label: "Slow" },
        { value: 2, label: "Medium" },
        { value: 3, label: "Fast" }
      ]}
    ],
    apparatus: ["Burette", "Conical Flask", "Pipette", "White Tile", "Phenolphthalein Indicator"],
    safetyNotes: ["Always use a pipette pump.", "Wash skin immediately if exposed to strong acid or base."],
    chartType: "line",
    chartLabel: { x: "Volume of HCl (mL)", y: "pH", title: "Titration Curve" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "electrolysis-water",
    title: "Electrolysis of Water",
    subject: "chemistry",
    ncert: "Class 10 Chemistry, Chapter 1 - Chemical Reactions",
    difficulty: "beginner",
    duration: "20 mins",
    description: "Study the electrolysis of water and collect hydrogen and oxygen gases.",
    aim: "To study the electrolysis of water and collect hydrogen and oxygen gases produced in a 2:1 ratio.",
    theory: "Water decomposition yields H2 gas at the cathode and O2 gas at the anode. Reaction: 2H2O(l) → 2H2(g) + O2(g). Volume of Hydrogen produced is exactly twice the volume of Oxygen.",
    procedure: [
      "Set the applied voltage using the slider (must be > 1.23V).",
      "Set the electrolyte (H2SO4) concentration.",
      "Click 'Start Electrolysis' and observe bubble formation.",
      "Notice that the cathode produces significantly more bubbles than the anode.",
      "Record the gas volumes accumulated in the test tubes every minute.",
      "Verify that the volume of H2 is approximately double that of O2."
    ],
    variables: [
      { id: "voltage", name: "Voltage", min: 1, max: 12, step: 1, defaultValue: 6, unit: "V" },
      { id: "concentration", name: "H₂SO₄ Conc.", min: 1, max: 20, step: 1, defaultValue: 5, unit: "%" },
      { id: "time", name: "Duration", min: 0, max: 10, step: 1, defaultValue: 0, unit: "min" }
    ],
    apparatus: ["Electrolytic Cell", "Carbon Electrodes", "Battery", "Test Tubes"],
    safetyNotes: ["Do not ignite gases near the apparatus.", "Wear goggles while handling sulfuric acid."],
    chartType: "line",
    chartLabel: { x: "Time (min)", y: "Gas Volume (mL)", title: "Gas Yield Over Time" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "flame-test",
    title: "Flame Test",
    subject: "chemistry",
    ncert: "Class 11 Chemistry, Chapter 10 - s-Block Elements",
    difficulty: "beginner",
    duration: "15 mins",
    description: "Identify metal ions by characteristic colors imparted to a Bunsen flame.",
    aim: "To identify metal ions by the characteristic colors they impart to a Bunsen burner flame.",
    theory: "When metal ions are heated, electrons excite to higher energy levels. As they drop back down, they emit photons of specific wavelengths. Emitted color is characteristic of the metal.",
    procedure: [
      "Select a metal ion sample from the dropdown.",
      "Dip the clean nichrome wire loop into the salt solution.",
      "Hold the wire loop in the non-luminous blue flame of the burner.",
      "Observe the characteristic color transition of the flame.",
      "Record the color observed for each tested metal ion.",
      "Toggle the cobalt blue glass mode to observe potassium mixed with sodium."
    ],
    variables: [
      { id: "metal", name: "Metal Sample", min: 0, max: 6, step: 1, defaultValue: 0, unit: "ion", options: [
        { value: 0, label: "Lithium (Li⁺)" },
        { value: 1, label: "Sodium (Na⁺)" },
        { value: 2, label: "Potassium (K⁺)" },
        { value: 3, label: "Calcium (Ca²⁺)" },
        { value: 4, label: "Strontium (Sr²⁺)" },
        { value: 5, label: "Copper (Cu²⁺)" },
        { value: 6, label: "Barium (Ba²⁺)" }
      ]},
      { id: "filter", name: "View Mode", min: 0, max: 1, step: 1, defaultValue: 0, unit: "mode", options: [
        { value: 0, label: "Naked Eye" },
        { value: 1, label: "Cobalt Blue Glass" }
      ]}
    ],
    apparatus: ["Bunsen Burner", "Nichrome Wire Loop", "Salt Solutions", "Cobalt Glass"],
    safetyNotes: ["Do not touch the hot nichrome wire.", "Handle the bunsen burner flame carefully."],
    chartType: "bar", // We'll replace the chart with the spectral line diagram visually later, but keep as data requirement
    chartLabel: { x: "Wavelength (nm)", y: "Intensity", title: "Emission Spectra" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "le-chatelier",
    title: "Le Chatelier's Principle",
    subject: "chemistry",
    ncert: "Class 11 Chemistry, Chapter 7 - Equilibrium",
    difficulty: "advanced",
    duration: "35 mins",
    description: "Effect of concentration, temperature, and pressure on N2O4 equilibrium.",
    aim: "To study the effect of changes in concentration, temperature, and pressure on a chemical equilibrium system (N₂O₄ ⇌ 2NO₂).",
    theory: "Le Chatelier's Principle states that if a dynamic equilibrium is disturbed by changing the conditions, the position of equilibrium shifts to counteract the change. N2O4 is colorless and NO2 is brown. Formation of NO2 is endothermic.",
    procedure: [
      "Observe the initial pale brown equilibrium mixture in the syringe.",
      "Increase temperature using the hot bath slider and observe shift toward brown NO2.",
      "Decrease temp with the ice bath and observe shift toward colorless N2O4.",
      "Compress the syringe (increase pressure). Equilibrium shifts to fewer gas moles (N2O4, lighter).",
      "Expand the syringe (decrease pressure) and observe the darkening color.",
      "Record the concentrations visually and mathematically."
    ],
    variables: [
      { id: "temperature", name: "Temperature", min: 0, max: 80, step: 5, defaultValue: 25, unit: "°C" },
      { id: "pressure", name: "Pressure (Piston)", min: 0.5, max: 5, step: 0.5, defaultValue: 1, unit: "atm" },
      { id: "stress", name: "Add Reagent", min: 0, max: 2, step: 1, defaultValue: 0, unit: "action", options: [
        { value: 0, label: "None" },
        { value: 1, label: "Add N₂O₄" },
        { value: 2, label: "Add NO₂" }
      ]}
    ],
    apparatus: ["Sealed Glass Syringe", "Gas Mixture", "Hot Water Bath", "Ice Bath"],
    safetyNotes: ["NO2 is a toxic gas. The syringe must remain sealed.", "Be careful with high temperature water baths."],
    chartType: "bar",
    chartLabel: { x: "Molecules", y: "Count (moles)", title: "Equilibrium Mixture" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  },
  {
    id: "paper-chromatography",
    title: "Paper Chromatography",
    subject: "chemistry",
    ncert: "Class 11 Chemistry, Chapter 12 - Organic Chemistry",
    difficulty: "beginner",
    duration: "25 mins",
    description: "Separate mixture components using paper chromatography and calculate Rf.",
    aim: "To separate the components of a mixture using paper chromatography and calculate Rf values.",
    theory: "Paper chromatography separates mixtures based on differential partition between a stationary phase (water bound in paper) and a mobile phase (solvent). Retention factor Rf = (distance moved by substance) / (distance moved by solvent front).",
    procedure: [
      "Select a mixture sample (ink, dye, plant extract) from the dropdown.",
      "Choose a solvent based on polarity (Water vs Nonpolar).",
      "Ensure the sample dot is spotted above the initial solvent level.",
      "Click 'Run Full' or adjust the run time slider to let the mobile phase rise.",
      "Observe the dye bands separating vertically at different rates.",
      "Turn on the ruler overlay and click on bands to measure distance.",
      "Calculate Rf values for each component."
    ],
    variables: [
      { id: "mixture", name: "Sample Mixture", min: 0, max: 3, step: 1, defaultValue: 0, unit: "type", options: [
        { value: 0, label: "Black Ink" },
        { value: 1, label: "Food Dye (Green)" },
        { value: 2, label: "Plant Extract" },
        { value: 3, label: "Marker Ink (Blue)" }
      ]},
      { id: "solvent", name: "Solvent Polarity", min: 0, max: 3, step: 1, defaultValue: 0, unit: "polar", options: [
        { value: 0, label: "Water (High Polar)" },
        { value: 1, label: "Ethanol" },
        { value: 2, label: "Acetone" },
        { value: 3, label: "Hexane (Nonpolar)" }
      ]},
      { id: "runtime", name: "Run Time", min: 0, max: 15, step: 1, defaultValue: 0, unit: "min" }
    ],
    apparatus: ["Chromatography Paper", "Solvent", "Capillary Tube", "Beaker", "Pencil", "Ruler"],
    safetyNotes: ["Use organic solvents in a well-ventilated fume hood.", "Do not inhale solvent vapors."],
    chartType: "bar",
    chartLabel: { x: "Rf Value", y: "Component", title: "Component Separation (Rf)" },
    scoring: { completion: 40, accuracy: 30, time: 15, journal: 15 }
  }
];
