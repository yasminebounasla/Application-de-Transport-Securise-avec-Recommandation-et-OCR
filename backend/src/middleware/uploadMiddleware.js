import multer from 'multer';
import path from 'node:path';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter,
});

export const uploadLicense = upload.single('license');
export const uploadSelfie = upload.single('selfie');
export const uploadBoth = upload.fields([
  { name: 'license', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]);

// export const handleMulterError = (err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     if (err.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({ 
//         error: 'File size too large. Maximum 10MB allowed.' 
//       });
//     }
//     return res.status(400).json({ error: err.message });
//   }
  
//   if (err) {
//     return res.status(400).json({ error: err.message });
//   }
  
//   next();
// };

export const handleMulterError = (err, req, res, next) => {
  console.log("🧐 Checking Multer status...");
  if (err instanceof multer.MulterError) {
    console.error("❌ Multer Error:", err.code, err.message);
    return res.status(400).json({ error: `Multer: ${err.message}` });
  }
  if (err) {
    console.error("❌ General Upload Error:", err.message);
    return res.status(400).json({ error: err.message });
  }
  console.log("✅ Multer validation passed.");
  next();
};