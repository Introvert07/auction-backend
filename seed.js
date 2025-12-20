const mongoose = require('mongoose');
const Component = require('./models/Component');
require('dotenv').config();

const techItems = [
  // --- FRONTEND (Web Visuals) ---
  { name: "React.js (Modern Web)", category: "Frontend", basePrice: 500000 },
  { name: "Next.js (SEO Framework)", category: "Frontend", basePrice: 500000 },
  { name: "Three.js (3D Graphics)", category: "Frontend", basePrice: 500000 },
  { name: "Tailwind CSS (Styling)", category: "Frontend", basePrice: 500000 },
  { name: "Material UI (Ready Components)", category: "Frontend", basePrice: 500000 },
  { name: "Bootstrap (Classic UI)", category: "Frontend", basePrice: 500000 },
  { name: "Animation Library (GSAP)", category: "Frontend", basePrice: 500000 },
  { name: "Figma Design Pro", category: "Frontend", basePrice: 500000 },
  { name: "Charts.js (Data Visuals)", category: "Frontend", basePrice: 500000 },
  { name: "FontAwesome (Icon Pack)", category: "Frontend", basePrice: 500000 },
  { name: "Sass (Advanced CSS)", category: "Frontend", basePrice: 500000 },
  { name: "Redux (State Management)", category: "Frontend", basePrice: 500000 },
  { name: "Vite (Fast Build Tool)", category: "Frontend", basePrice: 500000 },

  // --- BACKEND & DB (The Logic) ---
  { name: "Node.js (Server)", category: "Backend", basePrice: 500000 },
  { name: "Python FastAPI (High Speed)", category: "Backend", basePrice: 500000 },
  { name: "Python Flask (Simple API)", category: "Backend", basePrice: 500000 },
  { name: "MongoDB (NoSQL DB)", category: "Backend", basePrice: 500000 },
  { name: "MySQL (Relational DB)", category: "Backend", basePrice: 500000 },
  { name: "Firebase (Cloud Storage)", category: "Backend", basePrice: 500000 },
  { name: "Redis (Fast Caching)", category: "Backend", basePrice: 500000 },
  { name: "Appwrite (Backend-as-Service)", category: "Backend", basePrice: 500000 },
  { name: "Postman (API Testing)", category: "Backend", basePrice: 500000 },
  { name: "GraphQL (Query Language)", category: "Backend", basePrice: 500000 },
  { name: "Docker (Containerization)", category: "Backend", basePrice: 500000 },
  { name: "Supabase (Postgres Cloud)", category: "Backend", basePrice: 500000 },
  { name: "Cloud Hosting (AWS/Azure)", category: "Backend", basePrice: 500000 },

  // --- AI & DATA SCIENCE (The Brains) ---
  { name: "ChatGPT API (AI Chat)", category: "AI/ML", basePrice: 500000 },
  { name: "Image Recognition API", category: "AI/ML", basePrice: 500000 },
  { name: "Voice Assistant (Speech)", category: "AI/ML", basePrice: 500000 },
  { name: "Pandas (Data Analysis)", category: "AI/ML", basePrice: 500000 },
  { name: "Scikit-Learn (ML Models)", category: "AI/ML", basePrice: 500000 },
  { name: "TensorFlow (Deep Learning)", category: "AI/ML", basePrice: 500000 },
  { name: "PyTorch (AI Research)", category: "AI/ML", basePrice: 500000 },
  { name: "Recommendation System", category: "AI/ML", basePrice: 500000 },
  { name: "Sentiment Analysis tool", category: "AI/ML", basePrice: 500000 },
  { name: "Stock Price Predictor", category: "AI/ML", basePrice: 500000 },
  { name: "Object Detection (OpenCV)", category: "AI/ML", basePrice: 500000 },
  { name: "Jupyter Notebook Pro", category: "AI/ML", basePrice: 500000 },
  { name: "Natural Language (NLTK)", category: "AI/ML", basePrice: 500000 },
  { name: "Matplotlib (AI Plotting)", category: "AI/ML", basePrice: 500000 },

  // --- APP DEVELOPMENT (Mobile) ---
  { name: "Flutter (Cross-Platform)", category: "AppDev", basePrice: 500000 },
  { name: "React Native (JS Mobile)", category: "AppDev", basePrice: 500000 },
  { name: "Android Studio (Native)", category: "AppDev", basePrice: 500000 },
  { name: "Swift (iOS Native)", category: "AppDev", basePrice: 500000 },
  { name: "Unity (Game Engine)", category: "AppDev", basePrice: 500000 },
  { name: "Kotlin (Modern Android)", category: "AppDev", basePrice: 500000 },

  // --- HARDWARE (IoT Lab) ---
  { name: "Raspberry Pi 5 (Mini PC)", category: "Hardware", basePrice: 500000 },
  { name: "Arduino Uno (Board)", category: "Hardware", basePrice: 500000 },
  { name: "NodeMCU (Wi-Fi Board)", category: "Hardware", basePrice: 500000 },
  { name: "ESP32 (Bluetooth/Wi-Fi)", category: "Hardware", basePrice: 500000 },
  { name: "NVIDIA Jetson (AI Nano)", category: "Hardware", basePrice: 500000 },
  { name: "Bluetooth Module (HC-05)", category: "Hardware", basePrice: 500000 },
  { name: "Ultrasonic Sensor", category: "Hardware", basePrice: 500000 },
  { name: "Weather Sensor (DHT11)", category: "Hardware", basePrice: 500000 },
  { name: "LCD Display (16x2)", category: "Hardware", basePrice: 500000 },
  { name: "Servo Motor (Small)", category: "Hardware", basePrice: 500000 },
  { name: "GPS Module (NEO-6M)", category: "Hardware", basePrice: 500000 },
  { name: "Fingerprint Scanner", category: "Hardware", basePrice: 500000 },
  { name: "IR Sensor (Obstacle)", category: "Hardware", basePrice: 500000 },
  { name: "Gas/Smoke Sensor", category: "Hardware", basePrice: 500000 },
  { name: "Solar Panel (Portable)", category: "Hardware", basePrice: 500000 },
  { name: "Camera Module (PiCam)", category: "Hardware", basePrice: 500000 },
  { name: "RFID Reader & Tags", category: "Hardware", basePrice: 500000 },
  { name: "Touch Sensor TTP223", category: "Hardware", basePrice: 500000 },
  { name: "Real Time Clock (RTC)", category: "Hardware", basePrice: 500000 },
  { name: "Joystick Module", category: "Hardware", basePrice: 500000 }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Component.deleteMany({}); // Clears old items
    await Component.insertMany(techItems);
    console.log("✅ Tech Stack Seeded successfully!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();