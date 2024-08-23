import OpenAI from 'openai';
import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import sharp from 'sharp';

const openai = new OpenAI();

export const config = {
  api: {
    bodyParser: false,
  },
};

async function convertPdfToImage(pdfPath) {
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const pdf = await pdfjsLib.getDocument(data).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 }); // Increase scale for higher quality

  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  await page.render({ canvasContext: context, viewport: viewport }).promise;

  const pngBuffer = canvas.toBuffer('image/png');
  const jpegBuffer = await sharp(pngBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  return jpegBuffer;
}

function createCanvas(width, height) {
  const { createCanvas } = require('canvas');
  return createCanvas(width, height);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(process.cwd(), 'tmp');
  form.keepExtensions = true;

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let imageBuffer;
    if (file.mimetype === 'application/pdf') {
      imageBuffer = await convertPdfToImage(file.filepath);
    } else if (file.mimetype.startsWith('image/')) {
      imageBuffer = await fs.readFile(file.filepath);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const base64Image = imageBuffer.toString('base64');

    // Step 1: Transcribe the image using OpenAI
    const transcriptionResponse = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe all tabular content from this image. Format the output as a 2D array, where each inner array represents a row of data." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ],
        },
      ],
      max_tokens: 10000,
    });

    const transcribedData = JSON.parse(transcriptionResponse.choices[0].message.content);

    // Step 2: Create and populate Google Sheet
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        project_id: process.env.GOOGLE_PROJECT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Create a new sheet
    const createResponse = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: file.originalFilename.replace(/\.[^/.]+$/, ''),
        },
      },
    });

    const sheetId = createResponse.data.spreadsheetId;

    // Write data to the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1',
      valueInputOption: 'RAW',
      resource: {
        values: transcribedData,
      },
    });

    // Clean up temporary file
    await fs.unlink(file.filepath);

    res.status(200).json({
      message: 'File processed, transcribed, and sheet created successfully',
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Error processing file: ' + error.message });
  }
}