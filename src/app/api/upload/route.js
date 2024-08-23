import OpenAI from 'openai';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import sharp from 'sharp';

const openai = new OpenAI();

async function convertPdfToImage(pdfPath) {
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const pdf = await pdfjsLib.getDocument(data).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

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

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Save the file temporarily
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, file.name);
  await fs.writeFile(filePath, buffer);

  try {
    let imageBuffer;
    if (file.type === 'application/pdf') {
      imageBuffer = await convertPdfToImage(filePath);
    } else if (file.type.startsWith('image/')) {
      imageBuffer = buffer;
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
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
          title: file.name.replace(/\.[^/.]+$/, ''),
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
    await fs.unlink(filePath);

    return NextResponse.json({
      message: 'File processed, transcribed, and sheet created successfully',
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json({ error: 'Error processing file: ' + error.message }, { status: 500 });
  }
}