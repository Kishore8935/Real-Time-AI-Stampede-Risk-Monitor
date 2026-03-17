# GitHub Push Guide: Crowd Risk Monitor

Since the project contains many iterations (v1, v2, v3), it's important to only push the exact files needed to run the final web application. You don't want to push massive video files, virtual environments, or old test scripts.

## 1. What to Push (The Core Code)

Here is the whitelist of files and folders that should be committed to your repository:
git
### The Web Application
*   `v3_web/app.py`  **(The main backend server)**
*   `v3_web/templates/landing.html` **(The new configuration UI)**
*   `v3_web/templates/dashboard.html` **(The live monitoring dashboard)**

### The Physics Engine
*   `v2/density/` **(YOLO integration)**
    *   `estimator.py`
    *   `smoother.py`
    *   `region_history.py`
*   `v2/motion/` **(Optical Flow & Math)**
    *   `flow.py`
    *   `risk_fusion.py`

### Project Context
*   `requirements.txt` **(Crucial so others can install dependencies)**
*   `AI_CONTEXT.md` **(Optional, good instructions for future AI models)**

## 2. What NOT to Push (Crucial exclusions)
*   ❌ `venv/` (Python virtual environment - it's huge and platform-specific)
*   ❌ `v3_web/uploads/` (Contains user video files, which are too large for GitHub)
*   ❌ `__pycache__/` folders (Python bytecode)
*   ❌ `.yolov11n.pt` (The YOLO weights file. Usually people download this on first run, it's ~6MB so it's borderline, but better to let Ultralytics auto-download it).
*   ❌ Any `.mp4`, `.avi`, or `.mov` files lying around the root directory.

---

## 3. How to Setup and Push (Command Line)

If you haven't already initialized git, open your terminal in `c:\college\capstone2` and run exactly these steps:

### Step A: Create a `.gitignore`
This is the most important step so you don't accidentally push the wrong things.
**Run this in your terminal to create it:**
```bash
echo "venv/" > .gitignore
echo "__pycache__/" >> .gitignore
echo "*.mp4" >> .gitignore
echo "*.avi" >> .gitignore
echo "v3_web/uploads/" >> .gitignore
echo "*.pt" >> .gitignore
```

### Step B: Initialize Git and Add Files
Run these commands one by one:
```bash
# 1. Start tracking the project
git init

# 2. Add the specific folders we care about
git add v3_web/
git add v2/
git add requirements.txt
git add AI_CONTEXT.md
git add .gitignore

# 3. Save them as a commit
git commit -m "feat: complete v3 dashboard with Agentic AI parameters and Crowd Pressure"
```

### Step C: Push to GitHub
If you already created a blank repository on GitHub.com, they will give you a URL (e.g., `https://github.com/YourUsername/CapstoneProject.git`).
Run this to link them and push your code:

```bash
# Replace the URL with your actual GitHub repo URL
git remote add origin https://github.com/YourUsername/CapstoneProject.git

git branch -M main
git push -u origin main
```
