'use client'
import React, { useState, useRef } from 'react';
import { Box, Button, Typography, Paper, Alert, CircularProgress, AlertTitle } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function Home() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setUploadStatus('Image selected. Ready to upload.');
      setSheetUrl('');
    } else {
      setFile(null);
      setUploadStatus('Please select a valid image file.');
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading and processing image...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSheetUrl(data.sheetUrl);
        setUploadStatus(data.message);
      } else {
        throw new Error(data.error || 'Failed to upload and process file');
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
          <Typography variant="h2" className="text-4xl font-bold text-indigo-600 mb-2">🖼️ Image to Google Sheets</Typography>
          <Typography variant="h5" className="text-xl text-gray-600">Upload your image and we'll process it into Google Sheets</Typography>
        </Box>

        <Alert severity="info" className="mb-8">
          <AlertTitle>Welcome to Image to Google Sheets!</AlertTitle>
          Upload your images and we'll automatically process them and create a Google Sheet for you.
        </Alert>

        <Paper elevation={3} className="p-6 mt-4">
          <Box className="mb-4">
            <input
              type="file"
              accept="image/*"
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
              Select Image
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
            <Alert severity={uploadStatus.includes('Error') ? 'error' : 'success'} className="mb-4">
              {uploadStatus}
            </Alert>
          )}

          {sheetUrl && (
            <Alert severity="success" className="mt-4">
              <AlertTitle>Google Sheet Created</AlertTitle>
              Your data has been processed. View the Google Sheet here: 
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                Open Google Sheet
              </a>
            </Alert>
          )}

          {isUploading && <CircularProgress />}
        </Paper>
      </Box>
    </Box>
  );
}