// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Global state
let currentPage = window.location.pathname.split('/').pop();

// Initialize appropriate page
document.addEventListener('DOMContentLoaded', () => {
    if (currentPage === 'index.html') initUploadPage();
    else if (currentPage === 'test.html') initTestPage();
    else if (currentPage === 'results.html') initResultsPage();
});

// Upload Page Logic
function initUploadPage() {
    const pdfUpload = document.getElementById('pdf-upload');
    const startTestBtn = document.getElementById('start-test');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    pdfUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        progressContainer.classList.remove('hidden');
        startTestBtn.disabled = true;
        progressText.textContent = 'Processing PDF...';

        try {
            const pdfData = await readPDF(file);
            const questions = parseQuestions(pdfData);
            
            localStorage.setItem('testQuestions', JSON.stringify(questions));
            localStorage.removeItem('userAnswers');
            
            progressBar.style.width = '100%';
            progressText.textContent = 'PDF processed successfully!';
            startTestBtn.disabled = false;
        } catch (error) {
            console.error('Error processing PDF:', error);
            progressText.textContent = 'Error processing PDF. Please try another file.';
        }
    });

    startTestBtn.addEventListener('click', () => {
        window.location.href = 'test.html';
    });
}

// Test Page Logic
function initTestPage() {
    const questions = JSON.parse(localStorage.getItem('testQuestions'));
    if (!questions || questions.length === 0) {
        alert('No questions found. Please upload a PDF first.');
        window.location.href = 'index.html';
        return;
    }

    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const questionCounter = document.getElementById('question-counter');
    const progressBar = document.getElementById('progress-bar');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    let currentQuestion = 0;
    let userAnswers = JSON.parse(localStorage.getItem('userAnswers')) || Array(questions.length).fill(null);

    // Initialize test
    renderQuestion();

    // Navigation handlers
    prevBtn.addEventListener('click', () => {
        if (currentQuestion > 0) {
            currentQuestion--;
            renderQuestion();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (userAnswers[currentQuestion] === null) {
            alert('Please select an answer before continuing.');
            return;
        }

        if (currentQuestion < questions.length - 1) {
            currentQuestion++;
            renderQuestion();
        }
    });

    submitBtn.addEventListener('click', () => {
        localStorage.setItem('userAnswers', JSON.stringify(userAnswers));
        calculateResults();
    });

    function renderQuestion() {
        const question = questions[currentQuestion];
        
        // Update question text
        questionText.textContent = question.question;
        
        // Update counter
        questionCounter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
        
        // Update progress
        progressBar.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
        
        // Generate options (correct answer + 3 random wrong answers)
        const options = generateOptions(questions, currentQuestion);
        optionsContainer.innerHTML = '';
        
        options.forEach((option, index) => {
            const optionEl = document.createElement('div');
            optionEl.className = `option p-3 border border-gray-200 rounded-md cursor-pointer ${userAnswers[currentQuestion] === index ? 'selected' : ''}`;
            optionEl.textContent = option;
            optionEl.addEventListener('click', () => {
                document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
                optionEl.classList.add('selected');
                userAnswers[currentQuestion] = index;
            });
            optionsContainer.appendChild(optionEl);
        });
        
        // Update navigation buttons
        prevBtn.disabled = currentQuestion === 0;
        nextBtn.classList.toggle('hidden', currentQuestion === questions.length - 1);
        submitBtn.classList.toggle('hidden', currentQuestion !== questions.length - 1);
    }
}

// Results Page Logic
function initResultsPage() {
    const questions = JSON.parse(localStorage.getItem('testQuestions'));
    const userAnswers = JSON.parse(localStorage.getItem('userAnswers'));
    
    if (!questions || !userAnswers) {
        alert('No test results found. Please take the test first.');
        window.location.href = 'index.html';
        return;
    }

    const scoreDisplay = document.getElementById('score-display');
    const scoreBar = document.getElementById('score-bar');
    const scoreMessage = document.getElementById('score-message');
    const resultsContainer = document.getElementById('results-container');
    const retryBtn = document.getElementById('retry-btn');

    // Calculate score
    let correctCount = 0;
    questions.forEach((question, index) => {
        const options = generateOptions(questions, index);
        if (options[userAnswers[index]] === question.answer) {
            correctCount++;
        }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    scoreDisplay.textContent = `${score}%`;
    scoreBar.style.width = `${score}%`;

    // Set score message
    if (score >= 80) scoreMessage.textContent = 'Excellent work!';
    else if (score >= 60) scoreMessage.textContent = 'Good job!';
    else if (score >= 40) scoreMessage.textContent = 'Keep practicing!';
    else scoreMessage.textContent = 'Try again!';

    // Display results for each question
    questions.forEach((question, index) => {
        const options = generateOptions(questions, index);
        const userAnswer = userAnswers[index];
        const isCorrect = options[userAnswer] === question.answer;

        const resultEl = document.createElement('div');
        resultEl.className = `p-4 rounded-md ${isCorrect ? 'correct' : 'incorrect'}`;
        
        resultEl.innerHTML = `
            <div class="font-medium mb-2">Question ${index + 1}: ${question.question}</div>
            <div class="mb-1">Your answer: ${options[userAnswer] || 'Not answered'}</div>
            ${!isCorrect ? `<div class="font-medium">Correct answer: ${question.answer}</div>` : ''}
        `;
        
        resultsContainer.appendChild(resultEl);
    });

    // Retry button handler
    retryBtn.addEventListener('click', () => {
        localStorage.removeItem('userAnswers');
        window.location.href = 'test.html';
    });
}

// Helper Functions
async function readPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            try {
                const typedArray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const text = textContent.items.map(item => item.str).join(' ');
                    fullText += text + '\n';
                }
                
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.readAsArrayBuffer(file);
    });
}

function parseQuestions(text) {
    const questionRegex = /(?:Question|Q)[:\s]*(.*?)(?:\n|Answer|A)[:\s]*(.*?)(?=\n\n|Question|Q|$)/gi;
    const questions = [];
    let match;
    
    while ((match = questionRegex.exec(text)) !== null) {
        if (match[1] && match[2]) {
            questions.push({
                question: match[1].trim(),
                answer: match[2].trim()
            });
        }
    }
    
    return questions;
}

function generateOptions(questions, currentIndex) {
    const currentQuestion = questions[currentIndex];
    const options = [currentQuestion.answer];
    
    // Get 3 random wrong answers from other questions
    const otherQuestions = questions.filter((_, i) => i !== currentIndex);
    for (let i = 0; i < 3 && i < otherQuestions.length; i++) {
        const randomIndex = Math.floor(Math.random() * otherQuestions.length);
        options.push(otherQuestions[randomIndex].answer);
        otherQuestions.splice(randomIndex, 1);
    }
    
    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
}

function calculateResults() {
    window.location.href = 'results.html';
}
