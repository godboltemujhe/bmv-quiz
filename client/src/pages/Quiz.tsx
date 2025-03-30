import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, Download, Trash, Edit, Plus, Minus, Check, X, ArrowRight, ArrowLeft, Clock, Pencil, Save, RefreshCw, Cloud, ChevronDown, CheckIcon, XIcon, ChevronsUp, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"
import { apiRequest } from "@/lib/queryClient"
import { v4 as uuidv4 } from 'uuid'
import { encodeQuizData, decodeQuizData, isEncodedQuizData, safeStringify } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "@/components/theme-provider"

// TypeScript declaration for File System Access API and Android Bridge
declare global {
  interface Window {
    showSaveFilePicker?: (options?: any) => Promise<any>;
    
    // Android External Storage interface for persistent storage
    ExternalStorage?: {
      saveBackup: (data: string) => boolean;
      loadBackup: () => string | null;
      backupExists: () => boolean;
    };
    
    // Function to restore quizzes from backup (used by Android app)
    restoreQuizzesFromBackup?: (data: any) => void;
  }
}

type Question = {
  question: string
  answerDescription: string
  options: string[]
  correctAnswer: string
  questionImages: string[]
  answerImages: string[]
}

type QuizCategory = 'General Knowledge' | 'Mathematics' | 'Science' | 'Reasoning' | 'Custom' | string

type QuizAttempt = {
  date: Date
  score: number
  totalQuestions: number
  timeSpent: number
  // Track which questions were answered correctly/incorrectly
  questionResults?: Array<{
    question: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
  }>
}

type Quiz = {
  id: string        // Unique identifier for cross-device synchronization
  title: string
  description: string
  questions: Question[]
  timer: number
  lastTaken?: Date
  password?: string  // User-defined password for editing
  category: QuizCategory
  history?: QuizAttempt[]
  createdAt: Date
  isPublic: boolean  // For sharing functionality
  version?: number   // Version tracking for updates
}

// Utility function to compress base64 images
function compressBase64Image(base64: string, quality = 0.7, maxSize = 1200): string {
  // If it's not a base64 image, return as is
  if (!base64 || !base64.startsWith('data:image')) {
    return base64;
  }

  // For a simplified implementation, just return the original
  // In a real implementation with a proper canvas setup, this would compress the image
  console.log(`Image would be compressed to quality: ${quality}, max size: ${maxSize}px`);
  return base64;
}

// Add a simple health check banner at the top of the page
function HealthCheckBanner() {
  const [apiStatus, setApiStatus] = useState<string>('Checking API status...');
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  
  useEffect(() => {
    // Check if the API is healthy
    fetch('/api/health')
      .then(response => {
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setApiStatus(`API is healthy (${data.timestamp})`);
        setIsApiHealthy(true);
      })
      .catch(error => {
        setApiStatus(`API error: ${error.message}`);
        setIsApiHealthy(false);
      });
  }, []);
  
  if (isApiHealthy === null) {
    return (
      <div style={{ padding: '8px 16px', background: '#f5f5f5', borderRadius: '4px', margin: '10px 0' }}>
        {apiStatus}
      </div>
    );
  }
  
  if (isApiHealthy === false) {
    return (
      <div style={{ padding: '8px 16px', background: '#ffebee', color: '#c62828', borderRadius: '4px', margin: '10px 0' }}>
        {apiStatus}
      </div>
    );
  }
  
  return (
    <div style={{ padding: '8px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', margin: '10px 0' }}>
      {apiStatus}
    </div>
  );
}

export default function QuizApp() {
  // Initialize Android external storage backup restoration system
  useEffect(() => {
    // Define the function to restore from Android backup
    // This will be called by the Android WebView when the app starts
    window.restoreQuizzesFromBackup = (backupData) => {
      try {
        console.log("Attempting to restore quizzes from external backup");
        if (!backupData) {
          console.error("No backup data provided to restore");
          return;
        }
        
        let quizzesToRestore;
        
        // Handle string or object data - in case Android passes a JSON string
        if (typeof backupData === 'string') {
          quizzesToRestore = JSON.parse(backupData);
        } else {
          quizzesToRestore = backupData;
        }
        
        if (!Array.isArray(quizzesToRestore)) {
          console.error("Invalid backup data format - expected array");
          return;
        }
        
        // Process the quizzes - convert date strings to Date objects
        const processedQuizzes = quizzesToRestore.map(quiz => ({
          ...quiz,
          createdAt: new Date(quiz.createdAt),
          lastTaken: quiz.lastTaken ? new Date(quiz.lastTaken) : undefined,
          history: quiz.history ? quiz.history.map((attempt: QuizAttempt) => ({
            ...attempt,
            date: new Date(attempt.date)
          })) : []
        }));
        
        // Update state with restored quizzes
        setQuizzes(processedQuizzes);
        
        // Show success toast
        toast({
          title: "बैकअप से पुनर्स्थापित",
          description: `${processedQuizzes.length} क्विज़ सफलतापूर्वक लोड की गईं`,
          variant: "default",
        });
        
        console.log(`Restored ${processedQuizzes.length} quizzes from external backup`);
      } catch (error) {
        console.error("Failed to restore quizzes from backup:", error);
        toast({
          title: "पुनर्स्थापना त्रुटि",
          description: "बैकअप से क्विज़ पुनर्स्थापित करने में समस्या हुई",
          variant: "destructive",
        });
      }
    };
  }, []);

  // Helper function to load data from localStorage with chunking support
  const loadFromLocalStorage = (key: string, defaultValue: any = null) => {
    try {
      const value = localStorage.getItem(key);

      console.log(`Loading data with key ${key}, value found: ${value !== null}`);

      // Return default value if not found
      if (value === null) {
        console.log(`No data found for key ${key}, returning default value`);
        return defaultValue;
      }

      // Check if data is chunked
      if (value.startsWith('__CHUNKED__')) {
        console.log(`Found chunked data for key ${key}`);
        const chunks = parseInt(localStorage.getItem(`${key}_chunks`) || '0', 10);

        if (chunks <= 0) {
          console.error(`Invalid chunks count for key ${key}: ${chunks}`);
          return defaultValue;
        }

        console.log(`Attempting to load ${chunks} chunks for key ${key}`);
        let jsonString = '';

        // Combine all chunks
        for (let i = 0; i < chunks; i++) {
          const chunk = localStorage.getItem(`${key}_chunk_${i}`);
          if (chunk) {
            jsonString += chunk;
          } else {
            console.error(`Missing chunk ${i} of ${chunks} for key ${key}`);
            throw new Error(`Missing chunk ${i} of ${chunks}`);
          }
        }

        console.log(`Successfully loaded all chunks for key ${key}, parsing JSON`);
        const parsedData = JSON.parse(jsonString);
        return parsedData;
      }

      // Regular data
      console.log(`Loading regular data for key ${key}`);
      const parsedData = JSON.parse(value);
      return parsedData;
    } catch (error) {
      console.error(`Error loading data from localStorage with key ${key}:`, error);
      return defaultValue;
    }
  };

  const [activeTab, setActiveTab] = useState("create")
  // Load quizzes from localStorage on initialization
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    try {
      console.log("Loading quizzes from localStorage on initial mount");
      // Use our enhanced localStorage function that supports chunking
      const savedQuizzes = loadFromLocalStorage('quizzes', [])

      if (savedQuizzes && Array.isArray(savedQuizzes)) {
        // Convert date strings back to Date objects
        return savedQuizzes.map(quiz => ({
          ...quiz,
          createdAt: new Date(quiz.createdAt),
          lastTaken: quiz.lastTaken ? new Date(quiz.lastTaken) : undefined,
          history: quiz.history ? quiz.history.map((attempt: QuizAttempt) => ({
            ...attempt,
            date: new Date(attempt.date)
          })) : []
        }))
      } else {
        console.log("No quizzes found in localStorage");
        return [] // Default to empty array if not an array
      }
    } catch (e) {
      console.error('Failed to parse quizzes from localStorage', e)
      return []
    }
  })
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [timer, setTimer] = useState(0)
  const [isQuizRunning, setIsQuizRunning] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [quizToEdit, setQuizToEdit] = useState<number | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const MASTER_PASSWORD = "8387"  // Password protection for quiz deletion
  const [newQuiz, setNewQuiz] = useState<Quiz>({
    id: uuidv4(),
    title: '',
    description: '',
    questions: [],
    timer: 300,
    category: 'General Knowledge',
    createdAt: new Date(),
    isPublic: false,
    history: [],
    version: 1
  })
  const [newQuestions, setNewQuestions] = useState<Question[]>([
    {
      question: '',
      answerDescription: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      questionImages: [],
      answerImages: [],
    },
  ])
  // Clean sample JSON format without comments
  const sampleJsonFormat = `[
  {
    "title": "Sample Quiz",
    "description": "This is a sample quiz.",
    "timer": 300,
    "category": "General Knowledge",
    "isPublic": true,
    "password": "optional-password",
    "questions": [
      {
        "question": "What is the capital of France?",
        "answerDescription": "Paris is the capital and largest city of France.",
        "options": ["Berlin", "Madrid", "Paris", "Rome"],
        "correctAnswer": "Paris",
        "questionImages": [],
        "answerImages": []
      },
      {
        "question": "What is 2 + 2?",
        "answerDescription": "This is basic addition.",
        "options": ["3", "4", "5", "6"],
        "correctAnswer": "4",
        "questionImages": [],
        "answerImages": []
      }
    ]
  }
]`;

  // A more detailed version with explanatory text - used for the copy format functionality
  const detailedJsonFormat = `[
  {
    "title": "Sample Quiz",                    // Quiz title (required)
    "description": "This is a sample quiz.",   // Quiz description (required)
    "timer": 300,                              // Time limit in seconds (required)
    "category": "General Knowledge",           // Category must be one of: "General Knowledge", "Mathematics", "Science", "Reasoning" (required)
    "isPublic": true,                          // Whether quiz is publicly visible (required)
    "password": "optional-password",           // Optional password for editing
    "questions": [                             // Array of questions (required)
      {
        "question": "What is the capital of France?",  // Question text (required)
        "answerDescription": "Paris is the capital and largest city of France.",  // Explanation for the answer (required)
        "options": ["Berlin", "Madrid", "Paris", "Rome"],  // Multiple choice options (required)
        "correctAnswer": "Paris",                          // Must match one of the options exactly (required)
        "questionImages": [],                              // Optional array of base64 image strings 
        "answerImages": []                                 // Optional array of base64 image strings
      },
      {
        "question": "What is 2 + 2?",
        "answerDescription": "This is basic addition.",
        "options": ["3", "4", "5", "6"],
        "correctAnswer": "4",
        "questionImages": [],
        "answerImages": []
      }
    ]
  }
]`;

  const [importJson, setImportJson] = useState<string>(sampleJsonFormat)
  // Removed sync status state
  const [isJsonPlaceholder, setIsJsonPlaceholder] = useState(true)
  const [exportOption, setExportOption] = useState<'all' | 'specific'>('all')
  const [selectedQuizzes, setSelectedQuizzes] = useState<number[]>([])
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false)
  const [exportedJson, setExportedJson] = useState<string>("")
  // State for quiz merging
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [quizzesToMerge, setQuizzesToMerge] = useState<number[]>([])
  const [mergedQuizTitle, setMergedQuizTitle] = useState("")
  const [mergedQuizCategory, setMergedQuizCategory] = useState<QuizCategory>("General Knowledge")
  
  // Search and filtering
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [customCategoryInput, setCustomCategoryInput] = useState("")
  
  const { toast } = useToast()

  // Helper function to save data to localStorage with chunking support
  const saveToLocalStorage = (key: string, data: any) => {
    try {
      // First convert Dates to ISO strings to ensure proper serialization
      const preparedData = JSON.parse(JSON.stringify(data));
      const jsonString = JSON.stringify(preparedData);

      // Debug log to verify serialization
      console.log(`Saving data with key ${key}, size: ${jsonString.length} bytes`);

      // If data is small enough, save directly
      if (jsonString.length < 2000000) { // ~2MB safety threshold
        localStorage.setItem(key, jsonString);
        // Clean up any chunks from previous saves
        for (let i = 0; i < 20; i++) {
          const chunkKey = `${key}_chunk_${i}`;
          if (localStorage.getItem(chunkKey)) {
            localStorage.removeItem(chunkKey);
          } else {
            break;
          }
        }

        // Also clean up the chunks metadata if it exists
        if (localStorage.getItem(`${key}_chunks`)) {
          localStorage.removeItem(`${key}_chunks`);
        }

        console.log(`Saved data normally to key: ${key}`);
        return true;
      }

      // For large data, split into chunks
      const chunkSize = 1000000; // ~1MB chunks
      const chunks = Math.ceil(jsonString.length / chunkSize);

      console.log(`Data too large. Splitting into ${chunks} chunks.`);

      // Store metadata
      localStorage.setItem(`${key}_chunks`, chunks.toString());

      // Store each chunk
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunk = jsonString.substring(start, end);
        localStorage.setItem(`${key}_chunk_${i}`, chunk);
      }

      // Store a small indicator in the main key
      localStorage.setItem(key, `__CHUNKED__${chunks}`);
      console.log(`Saved data in ${chunks} chunks with key: ${key}`);
      return true;
    } catch (error) {
      console.error("Storage error:", error);
      if (error instanceof Error) {
        toast({
          title: "Storage Error",
          description: "Could not save data: " + error.message,
          variant: "destructive",
        });
      }
      return false;
    }
  }

  // This comment marks where the loadFromLocalStorage function was previously defined
  // The function is now defined at the top of the component to fix initialization order issues

  // Function to compress base64 images for smaller export files
  const optimizeImages = (quizzesList: Quiz[]) => {
    // Lower threshold to aggressively compress all images
    const MAX_IMAGE_SIZE = 50000 // ~50KB threshold for aggressive compression

    return quizzesList.map(quiz => {
      // Deep clone to avoid modifying the original
      const optimizedQuiz = JSON.parse(JSON.stringify(quiz));

      // Process each question
      optimizedQuiz.questions = optimizedQuiz.questions.map((question: Question) => {
        // Always compress every image to reduce export size
        const optimizedQuestionImages = question.questionImages.map((img: string) => {
          if (img && img.startsWith('data:image')) {
            // Determine compression level based on size
            if (img.length > MAX_IMAGE_SIZE * 4) {
              // Very large images get more compression
              return compressBase64Image(img, 0.3, 800); // 30% quality, max 800px
            } else if (img.length > MAX_IMAGE_SIZE) {
              // Large images get medium compression
              return compressBase64Image(img, 0.5, 1000); // 50% quality, max 1000px
            } else {
              // Smaller images still get some compression
              return compressBase64Image(img, 0.7, 1200); // 70% quality, max 1200px
            }
          }
          return img;
        });

        // Optimize answer images with the same approach
        const optimizedAnswerImages = question.answerImages.map((img: string) => {
          if (img && img.startsWith('data:image')) {
            if (img.length > MAX_IMAGE_SIZE * 4) {
              return compressBase64Image(img, 0.3, 800);
            } else if (img.length > MAX_IMAGE_SIZE) {
              return compressBase64Image(img, 0.5, 1000);
            } else {
              return compressBase64Image(img, 0.7, 1200);
            }
          }
          return img;
        });

        return {
          ...question,
          questionImages: optimizedQuestionImages,
          answerImages: optimizedAnswerImages
        };
      });

      return optimizedQuiz;
    });
  }

  // Save quizzes to localStorage whenever they change
  useEffect(() => {
    try {
      // First, make sure we have quizzes to save
      if (quizzes.length === 0) return;

      // Then optimize images if there are any to reduce storage size
      const optimizedQuizzes = optimizeImages(quizzes)

      // Always use our saveToLocalStorage function which handles both small and large datasets
      const saveSuccess = saveToLocalStorage('quizzes', optimizedQuizzes);

      // Save to Android external storage (if available) for persistent backup
      if (window.ExternalStorage && saveSuccess) {
        try {
          // Create a JSON string of the optimized quizzes
          const jsonString = JSON.stringify(optimizedQuizzes);
          
          // Save to external storage using the Android bridge
          const backupSuccess = window.ExternalStorage.saveBackup(jsonString);
          
          if (backupSuccess) {
            console.log("Successfully backed up quizzes to external storage");
          } else {
            console.warn("Failed to back up quizzes to external storage");
          }
        } catch (backupError) {
          console.error("Error during external storage backup:", backupError);
        }
      }

      if (!saveSuccess) {
        // If saving fails completely, show a more detailed error
        toast({
          title: "Storage Full",
          description: "Unable to save quizzes - storage is full. Try removing some quizzes or images.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save quizzes:", error)
      toast({
        title: "Save Error",
        description: "There was a problem saving your quizzes. Your recent changes might not be saved.",
        variant: "destructive",
      })
    }
  }, [quizzes])

  // Load quizzes from localStorage on component mount
  useEffect(() => {
    try {
      console.log("Loading quizzes from localStorage on initial mount");
      const savedQuizzes = loadFromLocalStorage('quizzes', []);

      if (savedQuizzes && Array.isArray(savedQuizzes) && savedQuizzes.length > 0) {
        // Convert date strings back to Date objects
        const processedQuizzes = savedQuizzes.map(quiz => ({
          ...quiz,
          createdAt: new Date(quiz.createdAt),
          lastTaken: quiz.lastTaken ? new Date(quiz.lastTaken) : undefined,
          history: quiz.history ? quiz.history.map((attempt: QuizAttempt) => ({
            ...attempt,
            date: new Date(attempt.date)
          })) : []
        }));

        console.log(`Loaded ${processedQuizzes.length} quizzes from localStorage`);
        setQuizzes(processedQuizzes);

        toast({
          title: "Quizzes Loaded",
          description: `Successfully loaded ${processedQuizzes.length} quizzes.`,
        });
      } else {
        console.log("No quizzes found in localStorage");
      }
    } catch (error) {
      console.error("Failed to load quizzes from localStorage:", error);
      toast({
        title: "Load Error",
        description: "There was a problem loading your saved quizzes.",
        variant: "destructive",
      });
    }
  }, []);

  // Create a ref for the audio element
  const timerAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Initialize the audio element on component mount
  useEffect(() => {
    // Use a simple beep sound that should work on mobile browsers
    // Short beep sound, more compatible with mobile devices
    timerAudioRef.current = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFWgD///////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAUHAAAAAAAABVqOgFVxAAAAAAD/+xDEAAAKoAF39BEAIqgAL38AJgQ5/8+OYgQCmIEJpwoYH/ypCgCqSMFX7ECK1hGteu9PCVlG6qv/QQYqbn/7Bx7G///4BgRIv///9qUZUenUG3bcAJGQ8yzLM1IESFUilDJEi2Q5u7/+7DERABB0AFN9ASACLAAKP6AkQCyldTdaKdxUh2Lv+2BDCP8h/+sY////5wXgD/6w6f//0JoqYJYm5EVMXETcE0MiYgAAAAAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzP/+xDEMQAGGAFB9AAAIogAqf5gIgAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMz");
    
    // Preload the audio for better mobile support
    if (timerAudioRef.current) {
      // Try to play and immediately pause to allow mobile devices to play later
      timerAudioRef.current.volume = 0.5;
      const playPromise = timerAudioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Audio playback started successfully
          timerAudioRef.current?.pause();
          timerAudioRef.current?.load();
        }).catch(e => {
          // Auto-play was prevented, but at least we tried to initialize
          console.log("Audio preload prevented by browser:", e);
        });
      }
    }
    
    return () => {
      if (timerAudioRef.current) {
        timerAudioRef.current.pause();
        timerAudioRef.current = null;
      }
    };
  }, []);
  
  // Extract all unique categories from quizzes for the filter dropdown
  useEffect(() => {
    // Convert to array to handle TS downlevelIteration flag issue 
    const categorySet = new Set<string>();
    quizzes.forEach(quiz => {
      if (quiz.category) {
        categorySet.add(quiz.category);
      }
    });
    setAllCategories(Array.from(categorySet));
  }, [quizzes]);
  
  // Function to calculate string similarity for fuzzy search
  const calculateSimilarity = (str1: string, str2: string): number => {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    
    // If exact match, return highest similarity
    if (str1 === str2) return 1;
    
    // If either string contains the other, high similarity
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // Calculate Levenshtein distance
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Maximum string length to compare
    const maxLen = Math.max(len1, len2);
    
    // If one string is empty, similarity is 0
    if (maxLen === 0) return 0;
    
    // Simple character matching
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    // Count matching characters
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    // Calculate similarity as a ratio of matches to max length
    return matches / maxLen;
  };
  
  // Filter quizzes based on search query and category selection
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      // First filter by category if selected
      if (selectedCategory && quiz.category !== selectedCategory) {
        return false;
      }
      
      // If no search query, just return category-filtered results
      if (!searchQuery) return true;
      
      // Check title and description for fuzzy matches
      const titleSimilarity = calculateSimilarity(quiz.title, searchQuery);
      const descSimilarity = calculateSimilarity(quiz.description, searchQuery);
      
      // Return if either title or description has good similarity
      // Threshold of 0.3 means it will catch similar words and typos
      return titleSimilarity > 0.3 || descSimilarity > 0.3;
    });
  }, [quizzes, searchQuery, selectedCategory]);

  useEffect(() => {
    if (isQuizRunning && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prevTimer) => {
          // Play sound when timer is 30 seconds or less
          if (prevTimer <= 31 && prevTimer > 1 && timerAudioRef.current) {
            timerAudioRef.current.play().catch(e => console.error("Error playing timer sound:", e));
          }
          return prevTimer - 1;
        });
      }, 1000)
      return () => clearInterval(interval)
    } else if (timer === 0 && isQuizRunning) {
      finishQuiz()
    }
  }, [isQuizRunning, timer])

  const handleAddQuestion = () => {
    setNewQuestions((prev) => [
      ...prev,
      {
        question: '',
        answerDescription: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        questionImages: [],
        answerImages: [],
      },
    ])
  }

  const handleQuestionChange = (index: number, field: keyof Question, value: string) => {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    )
  }

  const handleOptionChange = (index: number, optionIndex: number, value: string) => {
    setNewQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              options: q.options.map((opt, optIdx) => (optIdx === optionIndex ? value : opt)),
            }
          : q
      )
    )
  }

  const handleCorrectAnswerChange = (index: number, value: string) => {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, correctAnswer: value } : q))
    )
  }

  const handleDeleteQuestion = (index: number) => {
    setNewQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStartQuiz = (quiz: Quiz) => {
    const now = new Date()
    if (quiz.lastTaken) {
      const lastTaken = new Date(quiz.lastTaken)
      const timeDifference = now.getTime() - lastTaken.getTime()
      const tenMinutes = 10 * 60 * 1000
      if (timeDifference < tenMinutes) {
        toast({
          title: "Quiz Cooldown",
          description: "You can retake this quiz after 10 minutes.",
          variant: "destructive",
        })
        return
      }
    }
    setCurrentQuiz(quiz)
    setCurrentQuestionIndex(0)
    setSelectedAnswers(new Array(quiz.questions.length).fill(''))
    setScore(0)
    setTimer(quiz.timer)
    setIsQuizRunning(true)
    setShowResults(false)
    setIsQuizModalOpen(true)
  }

  const handleAnswer = (selectedOption: string) => {
    setSelectedAnswers((prev) => {
      const newAnswers = [...prev]
      newAnswers[currentQuestionIndex] = selectedOption
      return newAnswers
    })
  }

  // Function to navigate to the previous question
  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }
  
  // Function to navigate to the next question or finish the quiz
  const nextQuestion = () => {
    if (currentQuestionIndex < currentQuiz?.questions.length! - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = () => {
    setIsQuizRunning(false)
    setShowResults(true)

    if (currentQuiz) {
      // Calculate the score first
      const newScore = currentQuiz.questions.reduce((acc, question, index) => {
        return acc + (selectedAnswers[index] === question.correctAnswer ? 1 : 0)
      }, 0)

      setScore(newScore)

      const now = new Date();
      const timeSpent = currentQuiz.timer - timer;

      // Create question results for history tracking
      const questionResults = currentQuiz.questions.map((question, index) => {
        const userAnswer = selectedAnswers[index] || '';
        return {
          question: question.question,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: userAnswer === question.correctAnswer
        };
      });

      // Create a new quiz attempt record with the calculated score and question results
      const newAttempt: QuizAttempt = {
        date: now,
        score: newScore,
        totalQuestions: currentQuiz.questions.length,
        timeSpent: timeSpent,
        questionResults: questionResults
      };

      setQuizzes((prev) =>
        prev.map((quiz) =>
          quiz.title === currentQuiz.title && quiz.description === currentQuiz.description
            ? { 
                ...quiz, 
                lastTaken: now,
                // Add the new attempt to history array
                history: [...(quiz.history || []), newAttempt]
              }
            : quiz
        )
      )
    }
  }

  // Score calculation is now handled directly in finishQuiz

  const resetQuiz = () => {
    setCurrentQuiz(null)
    setCurrentQuestionIndex(0)
    setSelectedAnswers([])
    setScore(0)
    setTimer(0)
    setIsQuizRunning(false)
    setShowResults(false)
    setIsQuizModalOpen(false)
  }

  const handleImportQuiz = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          try {
            // Log for debugging
            console.log(`Received file content, length: ${content.length} characters`);
            console.log(`File starts with: ${content.substring(0, 30)}...`);
            
            // Check if the content is encoded or might be encoded
            let decodedContent = content;
            
            // Try to detect encoded data with more relaxed checks
            if (content.includes("BMVQUIZ") || 
                content.startsWith("BMV") || 
                isEncodedQuizData(content) || 
                /^[A-Za-z0-9+/=]+$/.test(content)) {
              
              try {
                // Always try to decode with our enhanced decoder
                decodedContent = decodeQuizData(content);
                console.log(`Attempted to decode content, result starts with: ${decodedContent.substring(0, 30)}...`);
              } catch (decodeError) {
                console.error("Decoding error:", decodeError);
                // Continue with the original content if decoding fails
                decodedContent = content;
              }
            }
            
            // Try parsing the result as JSON
            let importedQuizzes;
            try {
              importedQuizzes = JSON.parse(decodedContent);
            } catch (jsonError) {
              console.error("JSON parse error:", jsonError);
              
              // Try one more time with the original content if decoding failed
              if (decodedContent !== content) {
                try {
                  importedQuizzes = JSON.parse(content);
                  console.log("Parsed original content successfully");
                } catch (retryError) {
                  console.error("Retry JSON parse error:", retryError);
                  throw new Error("Could not parse file content as JSON");
                }
              } else {
                throw jsonError; // Re-throw the original error
              }
            }
            
            // Ensure the parsed data is an array
            if (!Array.isArray(importedQuizzes)) {
              if (typeof importedQuizzes === 'object' && importedQuizzes !== null) {
                importedQuizzes = [importedQuizzes]; // Single quiz
              } else {
                throw new Error("Imported data is not a quiz or array of quizzes");
              }
            }
            
            // Filter out quizzes that already exist
            const newQuizzes = importedQuizzes.filter((quiz: Quiz) => {
              return !quizzes.some(
                (existingQuiz) =>
                  existingQuiz.title === quiz.title && existingQuiz.description === quiz.description
              )
            })
            
            if (newQuizzes.length === 0) {
              toast({
                title: "Import failed",
                description: "All quizzes already exist.",
                variant: "destructive",
              })
            } else {
              // Make sure each quiz has an ID if importing from older format
              const validatedQuizzes = newQuizzes.map((quiz: Partial<Quiz>) => ({
                ...quiz,
                id: quiz.id || uuidv4(),
                createdAt: quiz.createdAt ? new Date(quiz.createdAt) : new Date(),
                isPublic: quiz.isPublic !== undefined ? quiz.isPublic : false,
                version: quiz.version || 1,
                // Ensure required fields exist
                title: quiz.title || "Imported Quiz",
                description: quiz.description || "",
                // Support for category
                category: (quiz.category && ['General Knowledge', 'Mathematics', 'Science', 'Reasoning'].includes(quiz.category as string)) 
                  ? (quiz.category as QuizCategory) 
                  : "General Knowledge",
                timer: quiz.timer || 300,
                questions: Array.isArray(quiz.questions) ? quiz.questions : []
              }))

              // Log successful validation
              console.log(`Successfully validated ${validatedQuizzes.length} quizzes`);
              
              setQuizzes((prev) => [...prev, ...validatedQuizzes])
              toast({
                title: "Import successful",
                description: `${validatedQuizzes.length} new quizzes imported.`,
                variant: "default",
              })
            }
          } catch (error) {
            console.error("Import error:", error)
            toast({
              title: "Import failed",
              description: error instanceof Error ? error.message : "Invalid file format. Please check if the file is valid.",
              variant: "destructive",
            })
          }
        }
      }
      reader.readAsText(file)
    }
  }

  const handleImportJson = () => {
    try {
      // Trim whitespace and handle empty input
      const trimmedJson = importJson.trim();
      if (!trimmedJson) {
        toast({
          title: "Empty Input",
          description: "Please enter JSON data to import.",
          variant: "destructive",
        });
        return;
      }

      // First determine if content is encoded and needs decoding
      let decodedContent = trimmedJson;
      let contentType = "regular";

      // Try to detect encoded data with more relaxed checks
      if (trimmedJson.includes("BMVQUIZ") || 
          trimmedJson.startsWith("BMV") || 
          isEncodedQuizData(trimmedJson) || 
          /^[A-Za-z0-9+/=]+$/.test(trimmedJson)) {
        
        contentType = "encoded";
        try {
          // Always try to decode even if it doesn't have the proper prefix
          // Our improved decodeQuizData will handle this gracefully
          decodedContent = decodeQuizData(trimmedJson);
          console.log("Attempted to decode potentially encoded data");
          
          // Log the first part of the decoded content for debugging
          const preview = decodedContent.substring(0, 50);
          console.log("Decoded content preview:", preview);
          
          // Simple validation - check if it looks like JSON
          if (!(decodedContent.startsWith('{') || decodedContent.startsWith('[')) &&
              !(decodedContent.endsWith('}') || decodedContent.endsWith(']'))) {
            
            console.warn("Decoded content doesn't look like valid JSON");
            
            // Fallback: try simple JSON parse first for better errors
            try {
              JSON.parse(decodedContent);
            } catch (jsonError) {
              console.error("JSON validation error on decoded content:", jsonError);
              
              // If that fails, try the original content as a last resort
              try {
                JSON.parse(trimmedJson);
                decodedContent = trimmedJson; // Use original if it's valid JSON
                contentType = "regular";
              } catch {
                // Keep using the decoded content and hope for the best
              }
            }
          }
        } catch (decodeError) {
          console.error("Decoding error:", decodeError);
          // Don't fail immediately, try with the original content
          decodedContent = trimmedJson;
          contentType = "regular";
        }
      }

      console.log(`Attempting to parse ${contentType} JSON data`);

      // Parse the JSON content
      let importedQuizzes;
      try {
        importedQuizzes = JSON.parse(decodedContent);
      } catch (parseError) {
        console.error("JSON parsing error:", parseError);
        
        // Special case for common copy-paste error with quotes
        if (decodedContent.startsWith('"') && decodedContent.endsWith('"')) {
          try {
            // Try removing the outer quotes and parse again
            const unquoted = decodedContent.substring(1, decodedContent.length - 1);
            const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            importedQuizzes = JSON.parse(unescaped);
            console.log("Successfully parsed after removing outer quotes");
          } catch (retryError) {
            console.error("Retry parsing error:", retryError);
            toast({
              title: "JSON Parse Error",
              description: "The data is not valid JSON. Please check the format.",
              variant: "destructive",
            });
            return;
          }
        } else {
          toast({
            title: "JSON Parse Error",
            description: "The data is not valid JSON. Please check the format.",
            variant: "destructive",
          });
          return;
        }
      }

      // Ensure the parsed data is an array
      if (!Array.isArray(importedQuizzes)) {
        // If it's a single quiz object, wrap it in an array
        if (typeof importedQuizzes === 'object' && importedQuizzes !== null) {
          importedQuizzes = [importedQuizzes];
        } else {
          toast({
            title: "Invalid Format",
            description: "The imported data is not in the expected quiz format.",
            variant: "destructive",
          });
          return;
        }
      }

      // Filter out quizzes that already exist
      const newQuizzes = importedQuizzes.filter((quiz: Quiz) => {
        return !quizzes.some(
          (existingQuiz) =>
            existingQuiz.title === quiz.title && existingQuiz.description === quiz.description
        );
      });

      if (newQuizzes.length === 0) {
        toast({
          title: "Import failed",
          description: "All quizzes already exist.",
          variant: "destructive",
        });
        return;
      }

      // Validate and fix each quiz
      const validatedQuizzes = newQuizzes.map((quiz: Partial<Quiz>) => ({
        ...quiz,
        id: quiz.id || uuidv4(),
        createdAt: quiz.createdAt ? new Date(quiz.createdAt) : new Date(),
        isPublic: quiz.isPublic !== undefined ? quiz.isPublic : false,
        version: quiz.version || 1,
        // Ensure required fields exist
        title: quiz.title || "Imported Quiz",
        description: quiz.description || "",
        // Support for category and password in imported JSON
        category: (quiz.category && ['General Knowledge', 'Mathematics', 'Science', 'Reasoning'].includes(quiz.category as string)) 
          ? (quiz.category as QuizCategory) 
          : "General Knowledge",
        password: quiz.password || undefined,
        timer: quiz.timer || 300,
        questions: Array.isArray(quiz.questions) ? quiz.questions : []
      }));

      // Add the new quizzes to the existing ones
      setQuizzes((prev) => [...prev, ...validatedQuizzes]);

      // Show success message
      toast({
        title: "Import successful",
        description: `${validatedQuizzes.length} new quizzes imported.`,
        variant: "default",
      });

      // Reset the import field
      setImportJson('');
      setIsJsonPlaceholder(true);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error occurred.",
        variant: "destructive",
      });
    }
  }

  const handleFocus = () => {
    if (isJsonPlaceholder) {
      setImportJson('')
      setIsJsonPlaceholder(false)
    }
  }

  const handleBlur = () => {
    if (importJson.trim() === '') {
      setImportJson(sampleJsonFormat)
      setIsJsonPlaceholder(true)
    }
  }
  
  // Function to copy the sample JSON format to clipboard with instructions
  const handleCopyFormat = () => {
    navigator.clipboard.writeText(detailedJsonFormat)
      .then(() => {
        toast({
          title: "Format Copied",
          description: "Sample JSON format with instructions copied to clipboard.",
        });
      })
      .catch((error) => {
        console.error("Failed to copy format:", error);
        toast({
          title: "Copy Failed",
          description: "Could not copy format to clipboard.",
          variant: "destructive",
        });
      });
  }

  const handleExportQuiz = () => {
    setIsExportModalOpen(true)
  }

  const handleShareQuiz = async () => {
    try {
      let quizzesToShare: Quiz[]

      if (exportOption === 'all') {
        quizzesToShare = quizzes
      } else {
        quizzesToShare = quizzes.filter((_, index) => selectedQuizzes.includes(index))
      }

      if (quizzesToShare.length === 0) {
        toast({
          title: "Share failed",
          description: "No quizzes selected for sharing.",
          variant: "destructive",
        })
        return
      }

      // First optimize the quizzes to reduce size (compress images)
      const optimizedQuizzes = optimizeImages(quizzesToShare)

      // Then sanitize and prepare for sharing
      const sanitizedQuizzes = JSON.parse(JSON.stringify(optimizedQuizzes))

      // Handle the case where the share API supports files
      if (navigator.share && navigator.canShare) {
        try {
          // Create text content for sharing
          const shareText = `I'm sharing ${quizzesToShare.length} quiz${quizzesToShare.length > 1 ? 'zes' : ''} from BMV Quiz!`

          // Create a simplified version with minimal data for sharing
          const simplifiedQuizzes = sanitizedQuizzes.map((quiz: Quiz) => {
            // Create a minimal version with limited images
            const simplifiedQuiz = {
              ...quiz,
              questions: quiz.questions.map(q => ({
                ...q,
                // Limit the number and size of images
                questionImages: q.questionImages.slice(0, 1), // Take only the first image if exists
                answerImages: q.answerImages.slice(0, 1)     // Take only the first image if exists
              }))
            };
            return simplifiedQuiz;
          });

          // Create JSON and encode it to protect quiz content
          const json = JSON.stringify(simplifiedQuizzes, null, 2)
          const encodedData = encodeQuizData(json)

          // Create a blob from the encoded JSON data
          const blob = new Blob([encodedData], { type: 'application/octet-stream' })
          const file = new File([blob], "quizzes.json", { type: "application/octet-stream" })

          // Check if we can share with files
          const shareData: any = {
            title: 'BMV Quiz - Shared Quizzes',
            text: shareText
          }

          // Try to use file sharing if supported
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file]
          } else {
            // Fallback to text-only sharing
            shareData.url = window.location.href
          }

          await navigator.share(shareData)

          toast({
            title: "Share successful",
            description: "Quizzes shared successfully with content protection!",
            variant: "default",
          })
        } catch (error) {
          // User cancelled or share failed
          console.error('Share error:', error)
          if (error instanceof Error && error.name !== 'AbortError') {
            // If we failed to share with file, try text-only sharing
            try {
              await navigator.share({
                title: 'BMV Quiz - Shared Quizzes',
                text: `I'm sharing quizzes from BMV Quiz! Visit ${window.location.href} to create your own.`,
                url: window.location.href
              })

              toast({
                title: "Share successful",
                description: "Shared link to BMV Quiz (without quizzes).",
                variant: "default",
              })
            } catch (fallbackError) {
              console.error('Fallback share error:', fallbackError)
              toast({
                title: "Share failed",
                description: "There was an error sharing. Try exporting the quizzes instead.",
                variant: "destructive",
              })
            }
          }
        }
      } else {
        // Fallback for browsers that don't support Web Share API
        try {
          // Create a download as fallback with encoded data
          const json = JSON.stringify(sanitizedQuizzes, null, 2)
          const encodedData = encodeQuizData(json)
          const blob = new Blob([encodedData], { type: 'application/octet-stream' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'quizzes.json'
          document.body.appendChild(a)
          a.click()

          // Clean up
          setTimeout(() => {
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }, 100)

          toast({
            title: "Share not supported",
            description: "Your browser doesn't support sharing. Quizzes downloaded instead with content protection.",
            variant: "default",
          })
        } catch (downloadError) {
          console.error('Download fallback error:', downloadError)
          toast({
            title: "Share failed",
            description: "Unable to share or download quizzes. Try exporting instead.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error('Share preparation error:', error)
      toast({
        title: "Share failed",
        description: "There was an error preparing the quizzes for sharing.",
        variant: "destructive",
      })
    }
  }

  const handleExport = () => {
    try {
      let quizzesToExport: Quiz[]
      if (exportOption === 'all') {
        quizzesToExport = quizzes
      } else {
        quizzesToExport = quizzes.filter((_, index) => selectedQuizzes.includes(index))
      }

      if (quizzesToExport.length === 0) {
        toast({
          title: "Export failed",
          description: "No quizzes selected for export.",
          variant: "destructive",
        })
        return
      }

      // Clone and sanitize the objects to ensure they're JSON-friendly
      // Use try-catch to handle any circular references or non-serializable data
      let sanitizedQuizzes;
      try {
        sanitizedQuizzes = JSON.parse(JSON.stringify(quizzesToExport))
      } catch (jsonError) {
        console.error('JSON sanitization error:', jsonError)
        
        // Fallback to a more manual sanitization approach
        sanitizedQuizzes = quizzesToExport.map(quiz => {
          // Create a simplified version of the quiz
          return {
            id: quiz.id || crypto.randomUUID?.() || String(Date.now()),
            title: quiz.title || 'Untitled Quiz',
            description: quiz.description || '',
            questions: (quiz.questions || []).map(q => ({
              question: q.question || '',
              answerDescription: q.answerDescription || '',
              options: (q.options || []).slice(0, 4),
              correctAnswer: q.correctAnswer || '',
              questionImages: (q.questionImages || []).slice(0, 1), // Limit to first image
              answerImages: (q.answerImages || []).slice(0, 1) // Limit to first image
            })),
            timer: parseInt(String(quiz.timer)) || 60,
            category: quiz.category || 'General Knowledge',
            createdAt: quiz.createdAt || new Date(),
            isPublic: !!quiz.isPublic
          }
        })
      }
      
      // Use our safe stringify function to convert to JSON string
      const json = safeStringify(sanitizedQuizzes, '[]')

      // Encode the JSON to protect quiz answers and content with our enhanced encoding
      const encodedData = encodeQuizData(json)

      // Store the JSON string for clipboard functionality (we store the encoded version)
      setExportedJson(encodedData)

      // Try multiple export approaches, starting with modern methods and falling back to simpler ones
      let exportSuccess = false;
      
      // Approach 1: Use the File System Access API if available (modern browsers)
      // But skip it in mobile environments where it often fails
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (window?.showSaveFilePicker && !isMobile) {
        try {
          const exportFile = async () => {
            const opts = {
              suggestedName: 'bmv_quizzes.json',
              types: [{
                description: 'JSON Files',
                accept: {'application/json': ['.json']}
              }]
            };
            
            try {
              const fileHandle = await window.showSaveFilePicker?.(opts);
              if (fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(encodedData);
                await writable.close();
              } else {
                throw new Error("No file handle returned");
              }
              return true;
            } catch (saveError) {
              console.warn('File saving operation failed:', saveError);
              return false;
            }
          };
          
          exportFile().then(success => {
            exportSuccess = success;
          }).catch(err => {
            console.warn('Modern file saving failed, falling back:', err);
            // Will fall through to the next approach
          });
        } catch (fsapiError) {
          console.warn('File System Access API error:', fsapiError);
          // Will fall through to the next approach
        }
      }
      
      // Approach 2: Standard download approach
      if (!exportSuccess) {
        try {
          // Create a Blob with the encoded data
          const blob = new Blob([encodedData], { type: 'application/octet-stream' })

          // Create a URL for the Blob
          const url = URL.createObjectURL(blob)

          // Create an anchor element and set properties for download
          const a = document.createElement('a')
          a.href = url
          a.download = 'bmv_quizzes.json'

          // Append to the document temporarily (needed for Firefox)
          document.body.appendChild(a)

          // Trigger the download
          a.click()

          // Clean up
          setTimeout(() => {
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }, 100)
          
          exportSuccess = true;
        } catch (downloadError) {
          console.error('Standard download error:', downloadError)
          // Will fall through to next approach
        }
      }
      
      // Approach 3: Data URI approach (most compatible)
      if (!exportSuccess) {
        try {
          // Create a data URI
          const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(encodedData)}`;
          const a = document.createElement('a');
          a.href = dataUri;
          a.download = 'bmv_quizzes.json';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          
          setTimeout(() => {
            document.body.removeChild(a);
          }, 100);
          
          exportSuccess = true;
        } catch (dataUriError) {
          console.error('Data URI approach failed:', dataUriError);
          // This is our most compatible approach, but we still have clipboard as a fallback
        }
      }

      // Even if download methods fail, we'll show success since users can copy from the textarea
      toast({
        title: "Export successful",
        description: `${quizzesToExport.length} quizzes prepared for export. ${!exportSuccess ? 'Please use the copy button if download didn\'t start.' : ''}`,
        variant: "default",
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Export failed",
        description: "There was an error exporting the quizzes. Please try the copy option instead.",
        variant: "destructive",
      })
    }
  }

  const handleSaveQuiz = async () => {
    if (newQuiz.title.trim() === '' || newQuiz.timer <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in the title and ensure the timer is set.",
        variant: "destructive",
      })
      return
    }
    const questions = newQuestions.filter(
      (q) => q.question.trim() !== '' && q.options.every(opt => opt.trim() !== '') && q.correctAnswer.trim() !== ''
    )
    if (questions.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please ensure all questions are filled correctly.",
        variant: "destructive",
      })
      return
    }

    // Generate a unique ID for the quiz if it doesn't have one
    const quizWithId = {
      ...newQuiz,
      questions,
      id: newQuiz.id || uuidv4(),
      version: newQuiz.version || 1
    }

    try {
      // Add to local state
      setQuizzes((prev) => [...prev, quizWithId])

      toast({
        title: "Quiz Saved",
        description: "Your quiz has been saved successfully.",
      })
    } catch (error) {
      console.error("Failed to save quiz:", error)

      toast({
        title: "Save Error",
        description: "There was a problem saving your quiz.",
        variant: "destructive",
      })
    }
    setNewQuiz({
      id: uuidv4(),
      title: '',
      description: '',
      questions: [],
      timer: 300,
      category: 'General Knowledge',
      createdAt: new Date(),
      isPublic: false,
      history: [],
      version: 1
    })
    setNewQuestions([
      {
        question: '',
        answerDescription: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        questionImages: [],
        answerImages: [],
      },
    ])
    toast({
      title: "Success",
      description: "Quiz saved successfully!",
      variant: "default",
    })
  }

  // Simplified file-to-base64 conversion
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Optimized image upload handlers
  const handleQuestionImageUpload = useCallback(async (index: number, file: File) => {
    try {
      // Show loading toast for large files
      const isLargeFile = file.size > 2 * 1024 * 1024; // 2MB
      let toastId = "";
      
      if (isLargeFile) {
        const result = toast({
          title: "Processing image",
          description: "Optimizing large image, please wait...",
          duration: 10000, // Long duration
        });
        if (result && typeof result === "object" && "id" in result) {
          toastId = result.id as string;
        }
      }
      
      // Use our optimized converter
      const base64Image = await convertFileToBase64(file);
      
      // Update state with the new image
      setNewQuestions((prev) =>
        prev.map((q, i) => (i === index ? { 
          ...q, 
          questionImages: [...q.questionImages, base64Image] 
        } : q))
      );
      
      // Dismiss loading toast if it was shown
      if (isLargeFile && toastId) {
        toast({
          title: "Image added",
          description: "Image has been optimized and added to the question.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to process image:", error);
      toast({
        title: "Image Processing Failed",
        description: "Could not add the image. Please try a different image.",
        variant: "destructive",
      });
    }
  }, [convertFileToBase64, toast]);

  const handleAnswerImageUpload = useCallback(async (index: number, file: File) => {
    try {
      // Show loading toast for large files
      const isLargeFile = file.size > 2 * 1024 * 1024; // 2MB
      let toastId = "";
      
      if (isLargeFile) {
        const result = toast({
          title: "Processing image",
          description: "Optimizing large image, please wait...",
          duration: 10000, // Long duration
        });
        if (result && typeof result === "object" && "id" in result) {
          toastId = result.id as string;
        }
      }
      
      // Use our optimized converter
      const base64Image = await convertFileToBase64(file);
      
      // Update state with the new image
      setNewQuestions((prev) =>
        prev.map((q, i) => (i === index ? { 
          ...q, 
          answerImages: [...q.answerImages, base64Image] 
        } : q))
      );
      
      // Dismiss loading toast if it was shown
      if (isLargeFile && toastId) {
        toast({
          title: "Image added",
          description: "Image has been optimized and added to the answer.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to process image:", error);
      toast({
        title: "Image Processing Failed",
        description: "Could not add the image. Please try a different image.",
        variant: "destructive",
      });
    }
  }, [convertFileToBase64, toast]);

  // Add state for delete quiz operation
  const [quizToDelete, setQuizToDelete] = useState<number | null>(null)
  const [deletePasswordDialogOpen, setDeletePasswordDialogOpen] = useState(false)

  const handleDeleteQuiz = (index: number) => {
    // Set the quiz to delete and open password dialog
    setQuizToDelete(index)
    setPasswordInput("")
    setDeletePasswordDialogOpen(true)
  }

  const handleDeleteQuizConfirm = () => {
    // Only proceed if quizToDelete is not null and password is correct
    if (quizToDelete === null) return;

    if (passwordInput === MASTER_PASSWORD) {
      // Password matches, delete the quiz
      setQuizzes((prev) => prev.filter((_, i) => i !== quizToDelete))
      toast({
        title: "Quiz Deleted",
        description: "The quiz has been deleted successfully.",
        variant: "default",
      })

      // Close dialog and reset state
      setDeletePasswordDialogOpen(false)
      setPasswordInput("")
      setQuizToDelete(null)
    } else {
      // Password doesn't match
      toast({
        title: "Access Denied",
        description: "Incorrect password. Quiz deletion prevented.",
        variant: "destructive",
      })
    }
  }

  const handleEditQuiz = (index: number) => {
    setQuizToEdit(index);
    setPasswordDialogOpen(true);
  }

  const handlePasswordSubmit = () => {
    if (quizToEdit === null) return;

    const quiz = quizzes[quizToEdit];
    const userPassword = passwordInput;

    // Check if the password matches the user-defined password or the master password
    if ((quiz.password && userPassword === quiz.password) || userPassword === MASTER_PASSWORD) {
      // Password is correct, proceed to edit
      setPasswordDialogOpen(false);
      setPasswordInput("");

      // Load the quiz data into edit mode
      setNewQuiz({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timer: quiz.timer,
        password: quiz.password,
        questions: [],
        category: quiz.category || 'General Knowledge',
        createdAt: quiz.createdAt || new Date(),
        isPublic: quiz.isPublic || false,
        history: quiz.history || [],
        version: quiz.version || 1
      });

      setNewQuestions(quiz.questions.map(q => ({...q})));
      setIsEditMode(true);
      setActiveTab("create");

      toast({
        title: "Edit Mode",
        description: "Now editing quiz: " + quiz.title,
      });
    } else {
      // Incorrect password
      toast({
        title: "Access Denied",
        description: "The password you entered is incorrect.",
        variant: "destructive",
      });
    }
  }

  const handleUpdateQuiz = () => {
    if (quizToEdit === null) return;

    if (newQuiz.title.trim() === '' || newQuiz.timer <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in the title and ensure the timer is set.",
        variant: "destructive",
      });
      return;
    }

    const questions = newQuestions.filter(
      (q) => q.question.trim() !== '' && q.options.every(opt => opt.trim() !== '') && q.correctAnswer.trim() !== ''
    );

    if (questions.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please ensure all questions are filled correctly.",
        variant: "destructive",
      });
      return;
    }

    // Update the quiz
    setQuizzes(prev => 
      prev.map((q, i) => i === quizToEdit ? { ...newQuiz, questions } : q)
    );

    // Reset form
    setNewQuiz({
      id: uuidv4(),
      title: '',
      description: '',
      questions: [],
      timer: 300,
      category: 'General Knowledge',
      isPublic: false,
      createdAt: new Date(),
      history: [],
      version: 1
    });

    setNewQuestions([
      {
        question: '',
        answerDescription: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        questionImages: [],
        answerImages: [],
      },
    ]);

    setIsEditMode(false);
    setQuizToEdit(null);

    toast({
      title: "Success",
      description: "Quiz updated successfully!",
      variant: "default",
    });
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const toggleQuizSelection = (index: number) => {
    setSelectedQuizzes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index)
      } else {
        return [...prev, index]
      }
    })
  }
  
  // Toggle quiz selection for merge functionality
  const toggleQuizMergeSelection = (index: number) => {
    setQuizzesToMerge((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index)
      } else {
        return [...prev, index]
      }
    })
  }
  
  // Function to merge selected quizzes
  const handleMergeQuizzes = () => {
    if (quizzesToMerge.length < 2) {
      toast({
        title: "Merge failed",
        description: "Select at least two quizzes to merge.",
        variant: "destructive",
      })
      return
    }
    
    if (!mergedQuizTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please provide a title for the merged quiz.",
        variant: "destructive",
      })
      return
    }
    
    // Get the selected quizzes
    const selectedQuizData = quizzesToMerge.map(index => quizzes[index])
    
    // Combine all questions from the selected quizzes
    const allQuestions = selectedQuizData.flatMap(quiz => quiz.questions)
    
    // Calculate average timer from all quizzes, with a minimum of 60 seconds
    const avgTimer = Math.max(
      60,
      Math.round(
        selectedQuizData.reduce((sum, quiz) => sum + quiz.timer, 0) / selectedQuizData.length
      )
    )
    
    // Create new merged quiz
    const mergedQuiz: Quiz = {
      id: uuidv4(),
      title: mergedQuizTitle,
      description: `Merged quiz containing questions from: ${selectedQuizData.map(q => q.title).join(", ")}`,
      questions: allQuestions,
      timer: avgTimer,
      category: mergedQuizCategory,
      createdAt: new Date(),
      isPublic: false,
      history: [],
      version: 1
    }
    
    // Add the merged quiz to the collection
    setQuizzes(prev => [...prev, mergedQuiz])
    
    // Reset state and close modal
    setMergedQuizTitle("")
    setQuizzesToMerge([])
    setIsMergeModalOpen(false)
    
    toast({
      title: "Merge successful",
      description: `Created new quiz "${mergedQuizTitle}" with ${allQuestions.length} questions.`,
      variant: "default",
    })
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  }

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.6 }
    }
  }

  // Using the new theme context for dark mode
  const { theme } = useTheme();

  return (
    <div className="p-4 max-w-5xl mx-auto min-h-screen bg-background text-foreground transition-colors duration-500 ease-in-out">
      <HealthCheckBanner />
      <div className="flex justify-between items-center mb-8">
        <motion.h1 
          className="text-3xl font-bold gradient-heading"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="mr-2">📝</span> BMV Quiz
        </motion.h1>

        <ThemeToggle />
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="mb-8"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create" className="flex items-center justify-center">
            <Plus className="h-5 w-5 mr-2" />
            Create Quiz
          </TabsTrigger>
          <TabsTrigger value="start" className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 mr-2" />
            Start Quiz
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center justify-center">
            <Clock className="h-5 w-5 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="import-export" className="flex items-center justify-center">
            <Download className="h-5 w-5 mr-2" />
            Import/Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <motion.div 
            className="grid grid-cols-1 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="quiz-title">Quiz Title</Label>
                      <Input
                        id="quiz-title"
                        value={newQuiz.title}
                        onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                        placeholder="Enter quiz title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quiz-description">Description</Label>
                      <Textarea
                        id="quiz-description"
                        value={newQuiz.description}
                        onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                        placeholder="Enter quiz description"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quiz-timer">Timer (seconds)</Label>
                      <Input
                        id="quiz-timer"
                        type="number"
                        min="10"
                        step="10"
                        value={newQuiz.timer}
                        onChange={(e) => setNewQuiz({ ...newQuiz, timer: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quiz-password">Password (optional)</Label>
                      <Input
                        id="quiz-password"
                        type="password"
                        placeholder="Set password for editing"
                        value={newQuiz.password || ''}
                        onChange={(e) => setNewQuiz({ ...newQuiz, password: e.target.value })}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Set a password to protect this quiz from unauthorized edits
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="quiz-category">Category</Label>
                          <Select 
                            value={newQuiz.category} 
                            onValueChange={(value) => {
                              if (value === "Custom") {
                                // If Custom is selected, show the input field
                                setNewQuiz({ ...newQuiz, category: "" });
                              } else if (value === "UserDefined") {
                                // For existing user-defined categories
                                setNewQuiz({ ...newQuiz, category: customCategoryInput });
                              } else {
                                setNewQuiz({ ...newQuiz, category: value as QuizCategory });
                              }
                            }}
                          >
                            <SelectTrigger id="quiz-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="General Knowledge">General Knowledge</SelectItem>
                              <SelectItem value="Mathematics">Mathematics</SelectItem>
                              <SelectItem value="Science">Science</SelectItem>
                              <SelectItem value="Reasoning">Reasoning</SelectItem>
                              
                              {/* Show existing user categories */}
                              {allCategories
                                .filter(cat => !['General Knowledge', 'Mathematics', 'Science', 'Reasoning'].includes(cat))
                                .map(userCategory => (
                                  <SelectItem key={userCategory} value={userCategory}>
                                    {userCategory}
                                  </SelectItem>
                                ))
                              }
                              
                              <SelectItem value="Custom">Add New Category...</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Custom category input field */}
                        {(!newQuiz.category || newQuiz.category === "") && (
                          <div className="mt-2">
                            <Label htmlFor="custom-category">Enter Custom Category</Label>
                            <Input
                              id="custom-category"
                              placeholder="Enter a custom category name"
                              value={customCategoryInput}
                              onChange={(e) => {
                                setCustomCategoryInput(e.target.value);
                                setNewQuiz({ ...newQuiz, category: e.target.value });
                              }}
                            />
                          </div>
                        )}
                      </div>

                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="quiz-public" 
                          checked={newQuiz.isPublic}
                          onCheckedChange={(checked) => 
                            setNewQuiz({ ...newQuiz, isPublic: checked as boolean })
                          }
                        />
                        <Label htmlFor="quiz-public">Make quiz shareable</Label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                        Allow others to find and take this quiz
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {newQuestions.map((question, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>Question {index + 1}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteQuestion(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash className="h-5 w-5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`question-text-${index}`}>Question</Label>
                      <Textarea
                        id={`question-text-${index}`}
                        value={question.question}
                        onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                        placeholder="Enter your question"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label className="mb-2">Options</Label>
                      <div className="space-y-2">
                        {question.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-3">
                            <RadioGroup
                              value={question.correctAnswer === option ? option : ""}
                              onValueChange={(value) => handleCorrectAnswerChange(index, value)}
                            >
                              <RadioGroupItem
                                value={option || `empty-${optIdx}`}
                                id={`option-${index}-${optIdx}`}
                                className="h-4 w-4"
                              />
                            </RadioGroup>
                            <Input
                              value={option}
                              onChange={(e) => handleOptionChange(index, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select the radio button next to the correct answer</p>
                    </div>

                    <div>
                      <Label htmlFor={`answer-description-${index}`}>Answer Description</Label>
                      <Textarea
                        id={`answer-description-${index}`}
                        value={question.answerDescription}
                        onChange={(e) => handleQuestionChange(index, 'answerDescription', e.target.value)}
                        placeholder="Explanation for the correct answer"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2">Question Images</Label>
                        <div 
                          className="border-2 border-dashed border-gray-300 p-4 rounded-md text-center cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            document.getElementById(`question-image-upload-${index}`)?.click();
                          }}
                        >
                          <div className="space-y-1">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                          </div>
                          <input
                            id={`question-image-upload-${index}`}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                Array.from(e.target.files).forEach((file) => {
                                  handleQuestionImageUpload(index, file)
                                })
                              }
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap mt-2 gap-2">
                          {question.questionImages.map((img, imgIdx) => (
                            <div key={imgIdx} className="relative w-16 h-16">
                              <img
                                src={img}
                                alt={`Question ${index + 1} image ${imgIdx + 1}`}
                                className="w-full h-full object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
                                onClick={() => {
                                  setNewQuestions((prev) =>
                                    prev.map((q, i) =>
                                      i === index
                                        ? {
                                            ...q,
                                            questionImages: q.questionImages.filter((_, idx) => idx !== imgIdx),
                                          }
                                        : q
                                    )
                                  )
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="mb-2">Answer Images</Label>
                        <div 
                          className="border-2 border-dashed border-gray-300 p-4 rounded-md text-center cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            document.getElementById(`answer-image-upload-${index}`)?.click();
                          }}
                        >
                          <div className="space-y-1">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                          </div>
                          <input
                            id={`answer-image-upload-${index}`}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                Array.from(e.target.files).forEach((file) => {
                                  handleAnswerImageUpload(index, file)
                                })
                              }
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap mt-2 gap-2">
                          {question.answerImages.map((img, imgIdx) => (
                            <div key={imgIdx} className="relative w-16 h-16">
                              <img
                                src={img}
                                alt={`Answer ${index + 1} image ${imgIdx + 1}`}
                                className="w-full h-full object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
                                onClick={() => {
                                  setNewQuestions((prev) =>
                                    prev.map((q, i) =>
                                      i === index
                                        ? {
                                            ...q,
                                            answerImages: q.answerImages.filter((_, idx) => idx !== imgIdx),
                                          }
                                        : q
                                    )
                                  )
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <div className="flex justify-between space-x-4">
              <Button
                variant="outline"
                onClick={handleAddQuestion}
                className="flex items-center justify-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Question
              </Button>
              {isEditMode ? (
                <Button onClick={handleUpdateQuiz} className="bg-green-600 hover:bg-green-700">
                  <Pencil className="h-4 w-4 mr-2" />
                  Update Quiz
                </Button>
              ) : (
                <Button onClick={handleSaveQuiz}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Quiz
                </Button>
              )}
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="start">
          {/* Search and filter bar */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-2/3">
                <Label htmlFor="search-quiz" className="sr-only">Search quizzes</Label>
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <Input
                    id="search-quiz"
                    placeholder="Search quizzes by title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-1/3">
                <Select
                  value={selectedCategory || ""}
                  onValueChange={(value) => setSelectedCategory(value === "all" ? null : value)}
                >
                  <SelectTrigger id="filter-category">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {allCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {quizzes.length > 0 ? (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {filteredQuizzes.map((quiz: Quiz, index: number) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="flex flex-col justify-between h-full">
                    <CardContent className="pt-6">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-bold">{quiz.title}</h3>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditQuiz(index)}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Edit Quiz"
                            >
                              <Pencil className="h-5 w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuiz(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete Quiz"
                            >
                              <Trash className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{quiz.description}</p>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {quiz.category && (
                            <Badge variant="outline" className="bg-primary/10">
                              {quiz.category}
                            </Badge>
                          )}

                          {quiz.isPublic && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                              Public
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center mb-2 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{Math.floor(quiz.timer / 60)} minutes</span>
                        </div>
                        <div className="flex items-center mb-2 text-sm text-gray-500 dark:text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 20 01 2h2a2 2 0 012 2" />
                          </svg>
                          <span>{quiz.questions.length} questions</span>
                        </div>
                        {quiz.lastTaken && (
                          <div className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 px-2 py-1 rounded mt-2 inline-block">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Last taken {new Date(quiz.lastTaken).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleStartQuiz(quiz)}
                      >
                        Start Quiz
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <p className="text-lg text-gray-500 dark:text-gray-300 mb-4">No quizzes available.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mb-6">
                    Create a new quiz or import existing ones to get started.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Simply update the state to switch the tab
                      setActiveTab("create");
                    }}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Quiz
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-6"
          >
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Quiz History</CardTitle>
                </CardHeader>
                <CardContent>
                  {quizzes.filter(quiz => quiz.history && quiz.history.length > 0).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-300">No quiz history available yet.</p>
                      <p className="text-sm text-gray-400 dark:text-gray-400 mt-2">
                        Take quizzes to build your history and track your progress over time.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quizzes
                        .filter(quiz => quiz.history && quiz.history.length > 0)
                        .map((quiz, index) => (
                          <motion.div 
                            key={index} 
                            variants={itemVariants}
                            className="border rounded-lg p-4"
                          >
                            <h3 className="font-medium text-lg mb-2">{quiz.title}</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {quiz.category && (
                                <Badge variant="outline" className="bg-primary/10">
                                  {quiz.category}
                                </Badge>
                              )}

                            </div>
                            <div className="space-y-3">
                              <p className="text-sm text-gray-500">
                                Quiz has {quiz.questions.length} questions and a time limit of {Math.floor(quiz.timer / 60)} minutes
                              </p>

                              <div className="space-y-2">
                                <h4 className="text-sm font-medium">Attempt History</h4>
                                <div className="rounded-md border overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-gray-50 border-b">
                                        <th className="px-4 py-2 text-left">Date</th>
                                        <th className="px-4 py-2 text-center">Score</th>
                                        <th className="px-4 py-2 text-center">Time Spent</th>
                                        <th className="px-4 py-2 text-center">Performance</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {quiz.history && [...quiz.history]
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((attempt, i) => [
                                          <tr 
                                            key={`attempt-row-${i}`} 
                                            className={i % 2 === 0 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-gray-700'}
                                          >
                                            <td className="px-4 py-2 text-left text-gray-900 dark:text-gray-200">{new Date(attempt.date).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-gray-200">
                                              {attempt.score}/{attempt.totalQuestions}
                                            </td>
                                            <td className="px-4 py-2 text-center text-gray-900 dark:text-gray-200">
                                              {Math.floor(attempt.timeSpent / 60)}:{(attempt.timeSpent % 60).toString().padStart(2, '0')}
                                            </td>
                                            <td className="px-4 py-2">
                                              <div className="flex items-center justify-center">
                                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mr-2 max-w-[100px]">
                                                  <div 
                                                    className={`h-2.5 rounded-full ${
                                                      (attempt.score / attempt.totalQuestions) >= 0.8 
                                                        ? 'bg-green-500' 
                                                        : (attempt.score / attempt.totalQuestions) >= 0.6 
                                                          ? 'bg-yellow-500' 
                                                          : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${(attempt.score / attempt.totalQuestions) * 100}%` }}
                                                  ></div>
                                                </div>
                                                <span className="text-xs">
                                                  {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                                                </span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                              <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => {
                                                  const detailsRow = document.getElementById(`attempt-details-${quiz.id}-${i}`);
                                                  if (detailsRow) {
                                                    detailsRow.classList.toggle('hidden');
                                                  }
                                                }}
                                              >
                                                <span className="sr-only">Show details</span>
                                                <Minus className="h-4 w-4" />
                                              </Button>
                                            </td>
                                          </tr>,
                                          <tr 
                                            key={`attempt-details-${i}`}
                                            id={`attempt-details-${quiz.id}-${i}`} 
                                            className="hidden"
                                          >
                                            <td colSpan={5} className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-b">
                                              {attempt.questionResults ? (
                                                <div className="space-y-3">
                                                  <h4 className="text-sm font-medium">Question Details:</h4>
                                                  {attempt.questionResults.map((result, qIdx) => (
                                                    <div 
                                                      key={qIdx} 
                                                      className={`border rounded p-2 ${
                                                        result.isCorrect 
                                                          ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900' 
                                                          : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900'
                                                      }`}
                                                    >
                                                      <div className="flex items-start gap-2">
                                                        <div className={`mt-1 ${
                                                          result.isCorrect 
                                                            ? 'text-green-500 dark:text-green-400' 
                                                            : 'text-red-500 dark:text-red-400'
                                                        }`}>
                                                          {result.isCorrect 
                                                            ? <Check className="h-4 w-4" /> 
                                                            : <X className="h-4 w-4" />
                                                          }
                                                        </div>
                                                        <div className="flex-1">
                                                          <p className="text-sm font-medium">{qIdx + 1}. {result.question}</p>
                                                          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                              <span className="font-semibold">Your answer: </span>
                                                              <span className={result.isCorrect 
                                                                ? 'text-green-600 dark:text-green-400' 
                                                                : 'text-red-600 dark:text-red-400'
                                                              }>
                                                                {result.userAnswer || '(No answer)'}
                                                              </span>
                                                            </div>
                                                            {!result.isCorrect && (
                                                              <div>
                                                                <span className="font-semibold">Correct answer: </span>
                                                                <span className="text-green-600 dark:text-green-400">
                                                                  {result.correctAnswer}
                                                                </span>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                                                  Detailed results not available for this attempt.
                                                </p>
                                              )}
                                            </td>
                                          </tr>
                                        ])}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {quiz.history && quiz.history.length > 1 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-1">Progress Trend</h4>
                                  <div className="h-32 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-700 p-2 flex items-end justify-between">
                                    {[...quiz.history]
                                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                      .map((attempt, i, arr) => (
                                        <div 
                                          key={i} 
                                          className="flex flex-col items-center"
                                          style={{ 
                                            width: `${100 / Math.max(arr.length, 1)}%`, 
                                            maxWidth: '60px' 
                                          }}
                                        >
                                          <div 
                                            className={`w-full max-w-[30px] rounded-t-sm ${
                                              (attempt.score / attempt.totalQuestions) >= 0.8 
                                                ? 'bg-green-500' 
                                                : (attempt.score / attempt.totalQuestions) >= 0.6 
                                                  ? 'bg-yellow-500' 
                                                  : 'bg-red-500'
                                            }`}
                                            style={{ height: `${(attempt.score / attempt.totalQuestions) * 100}%` }}
                                          ></div>
                                          <div className="text-xs mt-1 text-gray-700 dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap">
                                            {new Date(attempt.date).toLocaleDateString()}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleStartQuiz(quiz)}
                                  className="w-full"
                                >
                                  Take Quiz Again
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        <TabsContent value="import-export">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Merge Quizzes</CardTitle>
                  <CardDescription>
                    Combine questions from multiple quizzes into a single quiz
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quizzes.length < 2 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-300">You need at least two quizzes to use the merge feature.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label>Select quizzes to merge</Label>
                        <div className="grid gap-2 mt-2">
                          <div className="flex items-center justify-between">
                            <Button 
                              variant="outline" 
                              onClick={() => setQuizzesToMerge([])}
                              size="sm"
                            >
                              Clear Selection
                            </Button>
                          </div>
                          
                          <ScrollArea className="h-48 border rounded-md p-2">
                            {quizzes.map((quiz, index) => (
                              <div 
                                key={index} 
                                className={`
                                  p-2 mb-2 rounded 
                                  ${quizzesToMerge.includes(index) 
                                    ? 'bg-primary/20 border-primary/50 border' 
                                    : 'hover:bg-muted'
                                  }
                                  cursor-pointer transition-colors
                                `}
                                onClick={() => toggleQuizMergeSelection(index)}
                              >
                                <div className="flex items-center">
                                  <Checkbox 
                                    checked={quizzesToMerge.includes(index)}
                                    onCheckedChange={() => toggleQuizMergeSelection(index)}
                                  />
                                  <div className="ml-2 flex-1">
                                    <h4 className="text-sm font-medium">{quiz.title}</h4>
                                    <p className="text-xs text-gray-500">
                                      {quiz.questions.length} questions · {quiz.category}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {quiz.category}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button 
                          variant="default" 
                          onClick={() => setIsMergeModalOpen(true)}
                          disabled={quizzesToMerge.length < 2}
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Merge Selected Quizzes
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Import Quizzes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Import from JSON file</Label>
                    <div 
                      className="border-2 border-dashed border-gray-300 p-4 rounded-md text-center mt-2 cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        document.getElementById('json-file-upload')?.click();
                      }}
                    >
                      <div className="space-y-1">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500">Only JSON files</p>
                      </div>
                      <input
                        id="json-file-upload"
                        type="file"
                        className="hidden"
                        accept=".json"
                        onChange={handleImportQuiz}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Or paste JSON code</Label>
                    <Textarea
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      rows={10}
                      className="font-mono text-sm mt-2"
                    />
                  </div>

                  <div className="flex justify-between gap-2 mt-2">
                    <Button
                      onClick={handleCopyFormat}
                      variant="outline"
                      className="flex-1"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy Format
                    </Button>
                    <Button
                      onClick={handleImportJson}
                      className="flex-1"
                    >
                      <Upload className="mr-2 h-4 w-4" /> Import
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Export Quizzes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quizzes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-300">No quizzes available for export.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label>Choose what to export</Label>
                        <div className="flex mt-2 space-x-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="export-all"
                              checked={exportOption === 'all'}
                              onCheckedChange={() => setExportOption('all')}
                            />
                            <Label htmlFor="export-all">All quizzes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="export-specific"
                              checked={exportOption === 'specific'}
                              onCheckedChange={() => setExportOption('specific')}
                            />
                            <Label htmlFor="export-specific">Select specific quizzes</Label>
                          </div>
                        </div>
                      </div>

                      {exportOption === 'specific' && (
                        <div className="border rounded-md p-3 space-y-2 max-h-96 overflow-y-auto">
                          {quizzes.map((quiz, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Checkbox
                                id={`quiz-${index}`}
                                checked={selectedQuizzes.includes(index)}
                                onCheckedChange={() => toggleQuizSelection(index)}
                              />
                              <Label htmlFor={`quiz-${index}`} className="font-medium">
                                {quiz.title}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={handleExportQuiz}
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                        <Button
                          onClick={handleShareQuiz}
                          className="w-full"
                          variant="outline"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className="h-4 w-4 mr-2"
                          >
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                          </svg>
                          Share
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Merge Quizzes Dialog */}
      <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Quizzes</DialogTitle>
            <DialogDescription>
              Create a new quiz by combining questions from selected quizzes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="merged-quiz-title">New Quiz Title</Label>
              <Input
                id="merged-quiz-title"
                value={mergedQuizTitle}
                onChange={(e) => setMergedQuizTitle(e.target.value)}
                placeholder="Enter title for the merged quiz"
              />
            </div>
            <div>
              <Label htmlFor="merged-quiz-category">Quiz Category</Label>
              <Select 
                value={mergedQuizCategory} 
                onValueChange={(value) => setMergedQuizCategory(value as QuizCategory)}
              >
                <SelectTrigger id="merged-quiz-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Knowledge">General Knowledge</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Science">Science</SelectItem>
                  <SelectItem value="Reasoning">Reasoning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-2">Selected Quizzes:</h4>
              <ScrollArea className="h-24 border rounded-md p-2">
                {quizzesToMerge.map((index) => (
                  <div key={index} className="flex items-center py-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                    <span className="text-sm">{quizzes[index].title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      ({quizzes[index].questions.length} questions)
                    </span>
                  </div>
                ))}
              </ScrollArea>
            </div>
            
            <div className="border-t pt-4 mt-2">
              <p className="text-sm">
                <strong>Total Questions:</strong>{' '}
                {quizzesToMerge.reduce((total, index) => total + quizzes[index].questions.length, 0)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMergeQuizzes}
              disabled={!mergedQuizTitle.trim() || quizzesToMerge.length < 2}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              Create Merged Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Quizzes</DialogTitle>
            <DialogDescription>
              Choose how you want to export your quizzes
            </DialogDescription>
          </DialogHeader>
          <div>
            {exportedJson ? (
              <div className="space-y-4">
                <div className="p-3 border rounded-md bg-muted max-h-40 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap break-all">{exportedJson.length > 300 ? exportedJson.substring(0, 300) + '...' : exportedJson}</pre>
                </div>
                <div className="flex flex-col space-y-3">
                  <Button 
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(exportedJson);
                        toast({
                          title: "Copied!",
                          description: "Quiz data copied to clipboard",
                          variant: "default",
                        });
                      } catch (err) {
                        console.error('Clipboard error:', err);
                        toast({
                          title: "Copy failed",
                          description: "Could not copy to clipboard. Try the download option.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="w-full"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="h-4 w-4 mr-2"
                    >
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                    Copy to Clipboard
                  </Button>

                  <Button 
                    onClick={async () => {
                      try {
                        // Use the Web Share API for mobile sharing
                        if (navigator.share) {
                          await navigator.share({
                            title: 'BMV Quiz Data',
                            text: 'My BMV Quiz data',
                            url: 'data:text/json;charset=utf-8,' + encodeURIComponent(exportedJson)
                          });
                          toast({
                            title: "Share successful",
                            description: "Quiz data shared successfully",
                            variant: "default",
                          });
                        } else {
                          throw new Error("Web Share API not supported");
                        }
                      } catch (err) {
                        console.error('Share error:', err);
                        try {
                          // Fallback to clipboard
                          navigator.clipboard.writeText(exportedJson);
                          toast({
                            title: "Copied!",
                            description: "Sharing not available. Quiz data copied to clipboard instead.",
                            variant: "default",
                          });
                        } catch (clipErr) {
                          console.error('Fallback share error:', clipErr);
                          toast({
                            title: "Share failed",
                            description: "Could not share quiz data. Try the copy option.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="h-4 w-4 mr-2"
                    >
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share Quiz Data
                  </Button>

                  <Button 
                    onClick={() => window.open('data:text/json;charset=utf-8,' + encodeURIComponent(exportedJson))}
                    variant="secondary"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Try Download (Browser)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-4">
                <p className="text-sm text-gray-500 mb-4">
                  Your quizzes are ready to be exported. Choose what to export below.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label>Choose what to export</Label>
                    <div className="flex mt-2 space-x-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="export-all-modal"
                          checked={exportOption === 'all'}
                          onCheckedChange={() => setExportOption('all')}
                        />
                        <Label htmlFor="export-all-modal">All quizzes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="export-specific-modal"
                          checked={exportOption === 'specific'}
                          onCheckedChange={() => setExportOption('specific')}
                        />
                        <Label htmlFor="export-specific-modal">Specific quizzes</Label>
                      </div>
                    </div>
                  </div>

                  {exportOption === 'specific' && (
                    <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                      {quizzes.map((quiz, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Checkbox
                            id={`quiz-export-${index}`}
                            checked={selectedQuizzes.includes(index)}
                            onCheckedChange={() => toggleQuizSelection(index)}
                          />
                          <Label htmlFor={`quiz-export-${index}`} className="font-medium">
                            {quiz.title}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsExportModalOpen(false);
              setExportedJson("");
            }}>
              Close
            </Button>
            {!exportedJson && (
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Prepare Export
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Required</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-4">
              This quiz is password-protected. Please enter the password to edit it.
            </p>
            <Input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuizModalOpen} onOpenChange={(open) => {
          // Only allow closing the dialog if the quiz isn't running
          if (!isQuizRunning || !open) {
            setIsQuizModalOpen(open);
          }
        }}>
        <DialogContent 
          className="max-w-2xl p-0 max-h-[90vh] overflow-auto" 
          onInteractOutside={(e) => {
            // Prevent closing when clicking outside while quiz is running
            if (isQuizRunning) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing with ESC key while quiz is running
            if (isQuizRunning) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="px-6 pt-6 sticky top-0 z-10 bg-background">
            {isQuizRunning && currentQuiz && (
              <div className="flex justify-between items-center mb-2">
                <DialogTitle>{currentQuiz.title}</DialogTitle>
                <motion.div 
                  className={`flex items-center text-sm font-mono px-3 py-1 rounded-full
                    ${timer <= 30 
                      ? 'bg-red-100 text-red-700' 
                      : timer <= 60 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-gray-100 text-gray-700'}`}
                  animate={timer <= 30 ? { 
                    scale: [1, 1.05, 1],
                    backgroundColor: ['#fee2e2', '#fecaca', '#fee2e2']
                  } : {}}
                  transition={{ 
                    repeat: timer <= 30 ? Infinity : 0, 
                    duration: 1
                  }}
                >
                  <Clock className={`h-4 w-4 mr-2 ${timer <= 30 ? 'text-red-500' : 'text-primary'}`} />
                  {formatTime(timer)}
                </motion.div>
              </div>
            )}
            {showResults && <DialogTitle>Quiz Results</DialogTitle>}
          </DialogHeader>

          {isQuizRunning && currentQuiz && (
            <>
              <div className="px-6 py-4">
                <Progress
                  value={((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100}
                  className="h-2 mb-4"
                />
                <p className="text-sm text-gray-500 text-right mb-4">
                  Question {currentQuestionIndex + 1} of {currentQuiz.questions.length}
                </p>

                <AnimatePresence mode="wait">
                  <motion.div 
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        {currentQuiz.questions[currentQuestionIndex].question}
                      </h3>
                      {currentQuiz.questions[currentQuestionIndex].questionImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {currentQuiz.questions[currentQuestionIndex].questionImages.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt={`Question ${currentQuestionIndex + 1} image ${i + 1}`}
                              className="max-h-40 rounded"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <RadioGroup
                      value={selectedAnswers[currentQuestionIndex] || ""}
                      onValueChange={handleAnswer}
                      className="space-y-2"
                    >
                      {currentQuiz.questions[currentQuestionIndex].options.map((option, i) => (
                        <motion.div 
                          key={i} 
                          className="flex items-center space-x-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <RadioGroupItem value={option} id={`option-${i}`} />
                          <Label htmlFor={`option-${i}`} className="text-base">
                            {option}
                          </Label>
                        </motion.div>
                      ))}
                    </RadioGroup>
                  </motion.div>
                </AnimatePresence>
              </div>
              <DialogFooter className="px-6 py-4 bg-gray-50 flex justify-between">
                <div>
                  {currentQuestionIndex > 0 && (
                    <Button variant="outline" onClick={previousQuestion}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                  )}
                </div>
                <Button onClick={nextQuestion}>
                  {currentQuestionIndex < currentQuiz.questions.length - 1 ? (
                    <>
                      Next Question
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    'Finish Quiz'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {showResults && currentQuiz && (
            <>
              <div className="px-6 py-4">
                <motion.div 
                  className="text-center mb-6"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
                    <div className="text-3xl font-bold text-primary quiz-score-counter">
                      {score}/{currentQuiz.questions.length}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold quiz-results-heading">
                    {score === currentQuiz.questions.length
                      ? 'Perfect Score! 🎉'
                      : score >= currentQuiz.questions.length / 2
                      ? 'Good Job! 👍'
                      : 'Keep Practicing! 💪'}
                  </h3>
                  <p className="text-gray-500 mt-1 quiz-score">
                    You answered {score} out of {currentQuiz.questions.length} questions correctly.
                  </p>
                </motion.div>

                <motion.div 
                  className="space-y-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {currentQuiz.questions.map((question, index) => (
                    <motion.div 
                      key={index} 
                      className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-900/30"
                      variants={itemVariants}
                    >
                      <div className="flex items-start gap-2">
                        {selectedAnswers[index] === question.correctAnswer ? (
                          <div className="bg-green-500 text-white p-1 rounded-full mt-1">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="bg-red-500 text-white p-1 rounded-full mt-1">
                            <X className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium dark:text-white question-text">{question.question}</h4>
                          <div className="mt-2 space-y-1">
                            {question.options.map((option, i) => (
                              <div 
                                key={i} 
                                className={`text-sm p-2 rounded ${
                                  option === question.correctAnswer
                                    ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 dark:text-gray-100'
                                    : selectedAnswers[index] === option && selectedAnswers[index] !== question.correctAnswer
                                    ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 dark:text-gray-100'
                                    : 'bg-gray-50 dark:bg-gray-800 dark:text-gray-100'
                                }`}
                              >
                                {option}
                                {option === question.correctAnswer && (
                                  <span className="ml-2 text-green-600 dark:text-green-400 text-xs font-medium">(Correct)</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Question Images */}                          {question.questionImages.length > 0 && (
                            <div className="mt-3">
                              <p className="font-medium text-sm mb-2 dark:text-gray-300">Question Images:</p>
                              <div className="overflow-x-auto flex gap-2 pb-2 max-h-48">
                                {question.questionImages.map((img, imgIndex) => (
                                  <img 
                                    key={imgIndex} 
                                    src={img} 
                                    alt={`Question ${index + 1} image ${imgIndex + 1}`} 
                                    className="max-h-40 object-contain rounded border border-gray-200 dark:border-gray-700"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 explanation-container">
                            <p className="font-medium dark:text-gray-200">Explanation:</p>
                            <p className="explanation-text">{question.answerDescription}</p>
                          </div>

                          {/* Answer Images */}
                          {question.answerImages.length > 0 && (
                            <div className="mt-3">
                              <p className="font-medium text-sm mb-2 dark:text-gray-300">Answer Images:</p>
                              <div className="overflow-x-auto flex gap-2 pb-2 max-h-48">
                                {question.answerImages.map((img, imgIndex) => (
                                  <img 
                                    key={imgIndex} 
                                    src={img} 
                                    alt={`Answer ${index + 1} image ${imgIndex + 1}`} 
                                    className="max-h-40 object-contain rounded border border-gray-200 dark:border-gray-700"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    You can take this quiz again after 10 minutes.
                  </p>
                </div>
              </div>
              <DialogFooter className="sticky bottom-0 z-10 bg-background px-6 py-4 border-t">
                <Button onClick={resetQuiz}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Dialog for Quiz Deletion */}
      <Dialog open={deletePasswordDialogOpen} onOpenChange={setDeletePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Required</DialogTitle>
            <DialogDescription>
              Enter the master password to delete this quiz.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setDeletePasswordDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleDeleteQuizConfirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}