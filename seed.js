const mongoose = require('mongoose');
const Video = require('./models/Video');

const initialVideos = [
  {
    "qrId": "1",
    "title": "GEAPl Malaysia Recording",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781524129/GEAPl_Malaysia_Recording_1_ncglvj.mp4",
    "active": true
  },
  {
    "qrId": "2",
    "title": "HoloBox AI",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781524343/HoloBox_AI_qptwcv.mp4",
    "active": true
  },
  {
    "qrId": "3",
    "title": "HoloBox AI",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781524343/HoloBox_AI_qptwcv.mp4",
    "active": true
  },
  {
    "qrId": "4",
    "title": "Monotech App Record",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781524554/Monotech_App_record_g9bjxr.mp4",
    "active": true
  },
  {
    "qrId": "5",
    "title": "NBG Recording",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781525217/Nbg_Recording_oiowsu.mp4",
    "active": true
  },
  {
    "qrId": "6",
    "title": "Pi Industries Anamorphic Wall",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781524728/Piindustries_Anamorphicwall_k6codq.mp4",
    "active": true
  },
  {
    "qrId": "7",
    "title": "Tafe AR",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781525436/TafeAR_bsj13h.mp4",
    "active": true
  },
  {
    "qrId": "8",
    "title": "TCSVR Record",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781525475/Tcsvrrecord_1_vzjbls.mp4",
    "active": true
  },
  {
    "qrId": "9",
    "title": "VR Training Demo",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781527013/Vr_Training_Demo_1_1_dgj9mc.mp4",
    "active": true
  },
  {
    "qrId": "10",
    "title": "Tafe Sandune Record",
    "videoUrl": "https://res.cloudinary.com/dijapa6dp/video/upload/v1781527045/Tafesandunerecord_1_1_rv0m5e.mp4",
    "active": true
  }
];

async function seedDatabase() {
  try {
    const count = await Video.countDocuments();
    if (count === 0) {
      console.log('seedDatabase: Database is empty. Seeding initial 10 records...');
      await Video.insertMany(initialVideos);
      console.log('seedDatabase: Seeding completed successfully!');
    } else {
      console.log(`seedDatabase: Database already has ${count} records. Seeding skipped.`);
    }
  } catch (err) {
    console.error('seedDatabase: Error seeding database:', err.message);
  }
}

module.exports = seedDatabase;
