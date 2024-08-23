import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { google } from 'googleapis';
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI();

// Define the structure for tabular data
const TableData = z.array(z.array(z.string()));

const TableDataExtraction = z.object({
  tableData: TableData,
  description: z.string(),
});

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Uploaded file must be an image' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Step 1: Transcribe the image using OpenAI with structured output
    const transcriptionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all tabular content from this image. Format the output as a 2D array, where each inner array represents a row of data. Also provide a brief description of the table content." },
            { type: "image_url", image_url: { url: `data:${file.type};base64,${base64Image}`, detail: "high" } }
          ],
        },
      ],
      response_format: zodResponseFormat(TableDataExtraction, "table_data_extraction"),
    });
    console.log('Transcription Response:', transcriptionResponse);
    const extractedData = transcriptionResponse.choices[0].message;
    console.log('Extracted Data:', extractedData);

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
          title: `Processed Image - ${new Date().toISOString()}`,
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
        values: extractedData.tableData,
      },
    });

    // Add description to the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet2!A1',
      valueInputOption: 'RAW',
      resource: {
        values: [['Description'], [extractedData.description]],
      },
    });

    return NextResponse.json({
      message: 'Image processed, transcribed, and sheet created successfully',
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json({ error: 'Error processing image: ' + error.message }, { status: 500 });
  }
}