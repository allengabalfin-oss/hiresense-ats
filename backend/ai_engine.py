import os
import re
import shutil
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pypdf import PdfReader
import firebase_admin
from firebase_admin import credentials, db

# Create local storage directory for resumes
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize Firebase Admin safely
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://hiresense-app-97d54-default-rtdb.firebaseio.com/'
    })

app = FastAPI(title="HireSense AI Evaluation Service")

# Expose uploaded resumes statically at http://127.0.0.1:8000/resumes/<filename>
app.mount("/resumes", StaticFiles(directory=UPLOAD_DIR), name="resumes")

# Allow Next.js client requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TAXONOMY = {
    "python", "javascript", "typescript", "react", "next.js", "vue", "angular",
    "node.js", "fastapi", "express", "sql", "mysql", "postgresql", "firebase",
    "nosql", "mongodb", "docker", "kubernetes", "aws", "git", "nlp", "machine learning"
}

# Notification Request Schema
class StatusNotificationRequest(BaseModel):
    applicant_name: str
    applicant_email: str
    job_title: str
    new_status: str

# Configurable SMTP settings (optional environment variables)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

def extract_pdf_text(file_stream) -> str:
    reader = PdfReader(file_stream)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text

def normalize_and_extract_skills(raw_text: str) -> List[str]:
    clean_text = raw_text.lower()
    found_skills = set()
    for skill in TAXONOMY:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, clean_text):
            found_skills.add(skill)
    return sorted(list(found_skills))

def calculate_match_score(resume_skills: List[str], required_skills: List[str]) -> float:
    if not required_skills or not resume_skills:
        return 0.0

    matched_required = [s for s in required_skills if s in resume_skills]
    coverage_score = (len(matched_required) / len(required_skills)) * 100.0

    resume_doc = " ".join(resume_skills)
    job_doc = " ".join(required_skills)
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([resume_doc, job_doc])
    cos_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0] * 100.0

    final_score = (0.70 * coverage_score) + (0.30 * cos_sim)
    return round(float(final_score), 2)

@app.post("/evaluate")
async def evaluate_application(
    application_id: str = Form(...),
    job_id: str = Form(...),
    resume: UploadFile = File(...)
):
    try:
        # 1. Save uploaded file locally
        file_filename = f"{application_id}_{resume.filename}"
        file_path = os.path.join(UPLOAD_DIR, file_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)
        
        # Rewind to parse PDF text
        resume.file.seek(0)
        raw_text = extract_pdf_text(resume.file)
        extracted_skills = normalize_and_extract_skills(raw_text)

        # 2. Match against Job Requisition
        job_ref = db.reference(f"jobs/{job_id}")
        job_data = job_ref.get()
        if not job_data or "requiredSkills" not in job_data:
            raise HTTPException(status_code=404, detail="Job requisition not found")

        required_skills = [s.lower() for s in job_data["requiredSkills"]]
        match_score = calculate_match_score(extracted_skills, required_skills)

        # 3. Serve via FastAPI static endpoint
        resume_url = f"http://127.0.0.1:8000/resumes/{file_filename}"

        # 4. Save into Firebase RTDB
        app_ref = db.reference(f"applications/{application_id}")
        app_ref.update({
            "extractedSkills": extracted_skills,
            "matchScore": match_score,
            "status": "Evaluated",
            "resumeUrl": resume_url
        })

        return {
            "applicationId": application_id,
            "matchScore": match_score,
            "extractedSkills": extracted_skills,
            "resumeUrl": resume_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notify-status")
async def notify_candidate_status(payload: StatusNotificationRequest):
    subject = f"HireSense Application Update: {payload.job_title}"
    
    if payload.new_status == "Interview Scheduled":
        body = (
            f"Dear {payload.applicant_name},\n\n"
            f"Great news! Your qualifications for the {payload.job_title} position have been evaluated, "
            f"and our recruitment team has advanced your application to the interview stage.\n\n"
            f"Our talent coordinator will reach out shortly with scheduling details.\n\n"
            f"Best regards,\n"
            f"HireSense Talent Acquisition Team"
        )
    elif payload.new_status == "Offer Extended":
        body = (
            f"Dear {payload.applicant_name},\n\n"
            f"Congratulations! We are delighted to inform you that an offer has been extended "
            f"for the {payload.job_title} position.\n\n"
            f"Please check your portal or contact HR for next steps.\n\n"
            f"Best regards,\n"
            f"HireSense Talent Acquisition Team"
        )
    else:
        body = (
            f"Dear {payload.applicant_name},\n\n"
            f"Your application status for {payload.job_title} has been updated to: {payload.new_status}.\n\n"
            f"Best regards,\n"
            f"HireSense Talent Acquisition Team"
        )

    # Console simulation log for presentation/defense demos
    print("=" * 60)
    print(f"📧 [NOTIFICATION DISPATCHED] To: {payload.applicant_email}")
    print(f"Subject: {subject}")
    print(f"Status: {payload.new_status}")
    print("-" * 60)
    print(body)
    print("=" * 60)

    # SMTP delivery (triggers if environment variables are populated)
    if SMTP_USER and SMTP_PASS:
        try:
            msg = MIMEMultipart()
            msg["From"] = SMTP_USER
            msg["To"] = payload.applicant_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        except Exception as e:
            print(f"⚠️ SMTP delivery failed: {e}")

    return {"status": "sent", "recipient": payload.applicant_email, "stage": payload.new_status}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_engine:app", host="127.0.0.1", port=8000, reload=True)