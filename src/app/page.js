'use client'
import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const readFileData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsArrayBuffer(file);
  });
};

const convertPdfToImages = async (file) => {
  const images = [];
  const data = await readFileData(file);
  const pdf = await pdfjsLib.getDocument(data).promise;
  const canvas = document.createElement("canvas");
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1.5 });
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.95));
  }
  canvas.remove();
  return images;
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setUploadStatus('PDF selected. Ready to process.');
      
      // Generate preview
      const data = await readFileData(selectedFile);
      const pdf = await pdfjsLib.getDocument(data).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      setPdfPreview(canvas.toDataURL());
    } else {
      setFile(null);
      setPdfPreview(null);
      setUploadStatus('Please select a valid PDF file.');
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus('Processing PDF...');

    try {
      const images = await convertPdfToImages(file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          images: images,
          fileName: file.name 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setProcessResult(result);
      setUploadStatus(`PDF processed and ${images.length} image(s) uploaded successfully.`);
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGoogleAuth = async () => {
    try {
      const response = await fetch('/api/google-auth');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus('Error requesting Google authorization.');
    }
  };

  return (
    <Box className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Box className="max-w-7xl mx-auto">
        <Box className="text-center mb-8">
          <Typography variant="h2" className="text-4xl font-bold text-indigo-600 mb-2">📄 PDF to Google Sheets</Typography>
          <Typography variant="h5" className="text-xl text-gray-600">Upload your PDF and send it to Google Sheets</Typography>
        </Box>

        <Paper elevation={3} className="p-6 mt-4">
          <Box className="mb-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              ref={fileInputRef}
            />
            <Button
              variant="outlined"
              color="primary"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<CloudUploadIcon />}
            >
              Select PDF
            </Button>
          </Box>

          {file && (
            <Box className="mb-4">
              <Typography>{file.name}</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={processFile}
                disabled={isProcessing}
                startIcon={<CloudUploadIcon />}
              >
                {isProcessing ? 'Processing...' : 'Process and Upload PDF'}
              </Button>
            </Box>
          )}

          {pdfPreview && (
            <Box className="mb-4">
              <Typography variant="h6" className="mb-2">PDF Preview:</Typography>
              <img src={pdfPreview} alt="PDF preview" style={{maxWidth: '100%', height: 'auto'}} />
            </Box>
          )}

          {processResult && (
            <Box className="mb-4">
              <Button
                variant="contained"
                color="secondary"
                onClick={requestGoogleAuth}
              >
                Send to Google Sheets
              </Button>
            </Box>
          )}

          {uploadStatus && (
            <Alert severity={uploadStatus.includes('Error') ? 'error' : 'success'}>
              {uploadStatus}
            </Alert>
          )}

          {(isUploading || isProcessing) && <CircularProgress />}
        </Paper>
      </Box>
    </Box>
  );
}