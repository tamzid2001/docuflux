// app/api/upload.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    // Create a unique filename (optional)
    const uniqueFilename = `${Date.now()}-${file.name}`;

    // Define the upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    // Save the file
    const filePath = path.join(uploadDir, uniqueFilename);
    await fs.promises.writeFile(filePath, file.stream());

    return NextResponse.json({ success: true, path: `/uploads/${uniqueFilename}` });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ success: false, message: 'Error uploading file' });
  }
}