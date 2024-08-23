'use client'
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Alert, AlertTitle, Tab, Tabs, Box, TextField, Button, Typography, Select, MenuItem, Paper } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import SendIcon from '@mui/icons-material/Send';
import BookIcon from '@mui/icons-material/Book';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const colorPalette = {
  primary: '#4F46E5',
  secondary: '#10B981',
  accent: '#F59E0B',
  background: '#FFFFFF',
  text: '#1F2937',
};

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `👋 Hi! I'm the AI assistant. How can I help you today?` },
  ]);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage = { role: 'user', content: message };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setMessage('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([...messages, userMessage]),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setMessages(prevMessages => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          const updatedMessages = prevMessages.slice(0, -1);
          return [...updatedMessages, { ...lastMessage, content: lastMessage.content + chunk }];
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'assistant', content: 'Sorry, there was an error processing your request.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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
    setUploadStatus('Converting PDF to image...');

    try {
      // First, convert PDF to image
      const formData = new FormData();
      formData.append('file', file);

      const conversionResponse = await fetch('/api/convert-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!conversionResponse.ok) {
        throw new Error('Failed to convert PDF to image');
      }

      const { imageBlob } = await conversionResponse.json();

      // Now upload the image to S3
      setUploadStatus('Uploading image to S3...');
      const imageFile = new File([imageBlob], 'converted-image.jpg', { type: 'image/jpeg' });
      const s3FormData = new FormData();
      s3FormData.append('file', imageFile);

      const uploadResponse = await fetch('/api/upload-s3', {
        method: 'POST',
        body: s3FormData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to S3');
      }

      const { url } = await uploadResponse.json();
      setUploadStatus(`File uploaded successfully. URL: ${url}`);
    } catch (error) {
      console.error('Error:', error);
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Box className="max-w-7xl mx-auto">
        <Box className="text-center mb-8">
          <Typography variant="h2" className="text-4xl font-bold text-indigo-600 mb-2">🤖 AI Assistant</Typography>
          <Typography variant="h5" className="text-xl text-gray-600">Your intelligent companion for chat and file processing</Typography>
        </Box>

        <Alert severity="info" className="mb-8">
          <AlertTitle>Welcome to the AI Assistant!</AlertTitle>
          Chat with our AI, upload PDFs for processing, and get intelligent insights.
        </Alert>

        <Tabs value={activeTab} onChange={handleTabChange} className="w-full">
          <Tab label="Chat Assistant" value="chat" icon={<BookIcon />} />
          <Tab label="File Upload" value="upload" icon={<CloudUploadIcon />} />
        </Tabs>

        <Paper elevation={3} className="p-6 mt-4">
          {activeTab === 'chat' && (
            <Box>
              <Typography variant="h4" className="mb-4 flex items-center">
                <BookIcon className="mr-2" /> Chat with AI Assistant
              </Typography>
              <Box className="h-96 overflow-y-auto mb-4 space-y-4">
                {messages.map((msg, index) => (
                  <Paper
                    key={index}
                    className={`p-3 ${
                      msg.role === 'assistant' ? 'bg-indigo-100' : 'bg-emerald-100 ml-auto'
                    } max-w-[80%]`}
                  >
                    <Typography>{msg.content}</Typography>
                  </Paper>
                ))}
                <div ref={messagesEndRef} />
              </Box>
              <Box className="flex">
                <TextField
                  fullWidth
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage();
                    }
                  }}
                  placeholder="Ask me anything..."
                  variant="outlined"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  variant="contained"
                  color="primary"
                  endIcon={<SendIcon />}
                  disabled={isLoading}
                >
                  Send
                </Button>
              </Box>
            </Box>
          )}

          {activeTab === 'upload' && (
            <Box>
              <Typography variant="h4" className="mb-4 flex items-center">
                <CloudUploadIcon className="mr-2" /> File Upload
              </Typography>
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
                    {isUploading ? 'Uploading...' : 'Upload to S3'}
                  </Button>
                </Box>
              )}
              {uploadStatus && (
                <Alert severity={uploadStatus.includes('Error') ? 'error' : 'success'}>
                  {uploadStatus}
                </Alert>
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}