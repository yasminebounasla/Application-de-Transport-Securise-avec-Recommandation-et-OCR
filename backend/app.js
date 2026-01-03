import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// ici tu peux ajouter tes routes
// app.use('/api/auth', authRoutes);

export default app; // <- très important !
