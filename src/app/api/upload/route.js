import OpenAI from 'openai';
import { google } from 'googleapis';

const openai = new OpenAI();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { image, fileName } = req.body;

      // Step 1: Transcribe the image using OpenAI
      const transcriptionResponse = await openai.createImageTranscription({
        image: image,
        model: "gpt-4-vision-preview",
        prompt: "Transcribe all tabular content from this image. Format the output as a 2D array, where each inner array represents a row of data.",
        max_tokens: 1000,
      });

      const transcribedData = JSON.parse(transcriptionResponse.data.choices[0].text);

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
            title: fileName.replace('.pdf', ''),
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

      res.status(200).json({ 
        message: 'PDF processed, transcribed, and sheet created successfully',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`
      });
    } catch (error) {
      console.error('Error processing PDF:', error);
      res.status(500).json({ error: 'Error processing PDF: ' + error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}