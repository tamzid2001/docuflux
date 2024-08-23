import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { google } from 'googleapis';
import Canvas from 'canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const openai = new OpenAI();

class NodeCanvasFactory {
  create(width, height) {
    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function convertPdfToImage(pdfBuffer) {
  const canvasFactory = new NodeCanvasFactory();
  const loadingTask = getDocument({
    data: pdfBuffer,
    canvasFactory,
  });

  try {
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // Increase scale for higher quality
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    const renderContext = {
      canvasContext: canvasAndContext.context,
      viewport,
    };

    await page.render(renderContext).promise;
    const imageBuffer = canvasAndContext.canvas.toBuffer('image/png');

    // Release page resources
    page.cleanup();

    return imageBuffer;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw error;
  }
}

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  try {
    let imageBuffer;
    if (file.type === 'application/pdf') {
      imageBuffer = await convertPdfToImage(buffer);
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
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
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

    return NextResponse.json({
      message: 'File processed, transcribed, and sheet created successfully',
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json({ error: 'Error processing file: ' + error.message }, { status: 500 });
  }
}