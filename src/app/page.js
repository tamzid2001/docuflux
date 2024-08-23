'use client'
import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Box, Button, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// Dynamically import PDF viewer components
const PDFViewer = dynamic(() => import('@react-pdf-viewer/core').then(mod => mod.Viewer), {
  ssr: false,
});

// Dynamically import the styles
const PDFViewerStyles = dynamic(() => import('@react-pdf-viewer/core/lib/styles/index.css'), {
  ssr: false,
});

// Dynamically import pdfjs
const PDFJS = dynamic(() => import('pdfjs-dist/webpack'), { ssr: false });

const readFileData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
};

const convertPdfToImages = async (file) => {
  const images = [];
  const data = await readFileData(file);
  const pdf = await PDFJS.getDocument(data).promise;
  const canvas = document.createElement("canvas");
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1 });
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    images.push(canvas.toDataURL());
  }
  canvas.remove();
  return images;
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    PDFJS.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`;
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setPdfUrl(URL.createObjectURL(selectedFile));
      setUploadStatus('PDF selected. Ready to process.');
    } else {
      setFile(null);
      setPdfUrl(null);
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
      <PDFViewerStyles />
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
              onClick={() => fileInputRef.current.click()}
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

          {pdfUrl && (
            <Box className="mb-4" style={{ height: '500px' }}>
              <PDFViewer fileUrl={pdfUrl} />
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