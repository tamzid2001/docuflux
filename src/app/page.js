'use client'
import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, Alert, CircularProgress, AlertTitle, Grid } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { fromBlob } from 'pdf2pic';

const colorPalette = {
  primary: '#4F46E5',
  secondary: '#10B981',
  accent: '#F59E0B',
  background: '#FFFFFF',
  text: '#1F2937',
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [convertedImages, setConvertedImages] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setUploadStatus('PDF selected. Ready to convert.');
      setConvertedImages([]);
    } else {
      setFile(null);
      setUploadStatus('Please select a valid PDF file.');
    }
  };

  const convertPdfToImages = async () => {
    if (!file) return;

    setIsConverting(true);
    setUploadStatus('Converting PDF to images...');

    try {
      const options = {
        width: 800,
        height: 600,
        density: 330,
        format: "png",
      };

      const convert = fromBlob(file, options);
      const pages = await convert.bulk(-1);
      
      setConvertedImages(pages.map(page => page.base64));
      setUploadStatus('PDF converted to images. Ready to upload.');
    } catch (error) {
      console.error('Error converting PDF:', error);
      setUploadStatus(`Error converting PDF: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const uploadImages = async () => {
    if (convertedImages.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Uploading and processing images...');

    try {
      const uploadPromises = convertedImages.map((base64Image, index) => {
        const formData = new FormData();
        const blob = base64ToBlob(base64Image);
        formData.append('file', blob, `page-${index + 1}.png`);

        return fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      });

      const responses = await Promise.all(uploadPromises);
      const results = await Promise.all(responses.map(res => res.json()));

      const successfulUploads = results.filter(result => result.sheetUrl);
      if (successfulUploads.length > 0) {
        setUploadStatus(`Successfully processed ${successfulUploads.length} images.`);
        window.open(successfulUploads[0].sheetUrl, '_blank');
      } else {
        setUploadStatus('No images were successfully processed.');
      }
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const base64ToBlob = (base64) => {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  return (
    <Box className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Box className="max-w-7xl mx-auto">
        <Box className="text-center mb-8">
          <Typography variant="h2" className="text-4xl font-bold text-indigo-600 mb-2">📄 PDF to Google Sheets</Typography>
          <Typography variant="h5" className="text-xl text-gray-600">Upload your PDF, convert to images, and process into Google Sheets</Typography>
        </Box>

        <Alert severity="info" className="mb-8">
          <AlertTitle>Welcome to PDF to Google Sheets!</AlertTitle>
          Upload your PDFs, convert them to images, and we'll process them into Google Sheets.
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
                onClick={convertPdfToImages}
                disabled={isConverting}
                startIcon={<CloudUploadIcon />}
              >
                {isConverting ? 'Converting...' : 'Convert to Images'}
              </Button>
            </Box>
          )}
          
          {convertedImages.length > 0 && (
            <Box className="mb-4">
              <Typography variant="h6" className="mb-2">Converted Images:</Typography>
              <Grid container spacing={2}>
                {convertedImages.map((image, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <img src={image} alt={`Page ${index + 1}`} style={{ width: '100%', height: 'auto' }} />
                  </Grid>
                ))}
              </Grid>
              <Button
                variant="contained"
                color="secondary"
                onClick={uploadImages}
                disabled={isUploading}
                className="mt-4"
              >
                {isUploading ? 'Uploading...' : 'Upload Images to Google Sheets'}
              </Button>
            </Box>
          )}
          
          {uploadStatus && (
            <Alert severity={uploadStatus.includes('Error') ? 'error' : 'success'}>
              {uploadStatus}
            </Alert>
          )}

          {(isConverting || isUploading) && <CircularProgress />}
        </Paper>
      </Box>
    </Box>
  );
}