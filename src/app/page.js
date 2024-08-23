'use client'
import React, { useState, useRef } from 'react';
import { Box, Button, Typography, Paper, Alert, CircularProgress, AlertTitle } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const colorPalette = {
  primary: '#4F46E5',
  secondary: '#10B981',
  accent: '#F59E0B',
  background: '#FFFFFF',
  text: '#1F2937',
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setUploadStatus('PDF selected. Ready to upload.');
    } else {
      setFile(null);
      setUploadStatus('Please select a PDF file.');
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading and processing PDF...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload and process file');
      }

      const { message, sheetUrl } = await uploadResponse.json();
      setUploadStatus(`File processed successfully. ${message}`);
      if (sheetUrl) {
        window.open(sheetUrl, '_blank');
      }
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Box className="max-w-7xl mx-auto">
        <Box className="text-center mb-8">
          <Typography variant="h2" className="text-4xl font-bold text-indigo-600 mb-2">📄 PDF to Google Sheets</Typography>
          <Typography variant="h5" className="text-xl text-gray-600">Upload your PDF and we'll process it into Google Sheets</Typography>
        </Box>

        <Alert severity="info" className="mb-8">
          <AlertTitle>Welcome to PDF to Google Sheets!</AlertTitle>
          Upload your PDFs and we'll automatically process them and create a Google Sheet for you.
        </Alert>

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
                onClick={uploadFile}
                disabled={isUploading}
                startIcon={<CloudUploadIcon />}
              >
                {isUploading ? 'Processing...' : 'Process and Upload'}
              </Button>
            </Box>
          )}
          
          {uploadStatus && (
            <Alert severity={uploadStatus.includes('Error') ? 'error' : 'success'}>
              {uploadStatus}
            </Alert>
          )}

          {isUploading && <CircularProgress />}
        </Paper>
      </Box>
    </Box>
  );
}