'use client'
import React, { useState, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import axios from 'axios';
import { Box, Button, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function Home() {
  const [file, setFile] = useState(null);
  const [pdfImage, setPdfImage] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setUploadStatus('PDF selected. Ready to process.');
      
      // Convert the first page to an image for preview
      const reader = new FileReader();
      reader.onload = async function(event) {
        const pdfData = new Uint8Array(event.target.result);
        const pdf = await pdfjs.getDocument({data: pdfData}).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({scale: 1.5});
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({canvasContext: context, viewport: viewport}).promise;
        setPdfImage(canvas.toDataURL());
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setFile(null);
      setPdfImage(null);
      setUploadStatus('Please select a valid PDF file.');
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus('Processing PDF...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/process-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setProcessResult(response.data);
      setUploadStatus('PDF processed successfully. Ready to send to Google Sheets.');
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGoogleAuth = async () => {
    try {
      const response = await axios.get('/api/google-auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus('Error requesting Google authorization.');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
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
                {isProcessing ? 'Processing...' : 'Process PDF'}
              </Button>
            </Box>
          )}

          {pdfImage && (
            <Box className="mb-4">
              <Typography variant="h6" className="mb-2">PDF Preview:</Typography>
              <img src={pdfImage} alt="PDF preview" style={{maxWidth: '100%', height: 'auto'}} />
            </Box>
          )}

          {file && (
            <Box className="mb-4">
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
              >
                <Page pageNumber={pageNumber} />
              </Document>
              <Typography>Page {pageNumber} of {numPages}</Typography>
              <Button disabled={pageNumber <= 1} onClick={() => setPageNumber(pageNumber - 1)}>
                Previous
              </Button>
              <Button disabled={pageNumber >= numPages} onClick={() => setPageNumber(pageNumber + 1)}>
                Next
              </Button>
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