// npm i express node-fetch dotenv cors
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) console.warn('OPENAI_API_KEY not set');

app.post('/api/generate-slides', async (req,res)=>{
  try {
    const { text, language } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model:'gpt-4',
        messages:[
          {role:'system', content:'You are an expert presentation creator.'},
          {role:'user', content:`Create slides in ${language} from this text: ${text}. Format each slide as:
          Title: <slide title>
          Content: <bullet points>
          Image: <image description>`}
        ],
        temperature:0.7,
        max_tokens:700
      })
    });

    const data = await response.json();
    res.json(data);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/generate-image', async (req,res)=>{
  try {
    const { prompt } = req.body;
    const r = await fetch('https://api.openai.com/v1/images/generations',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({ prompt, n:1, size:'512x512' })
    });
    const j = await r.json();
    res.json(j);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
