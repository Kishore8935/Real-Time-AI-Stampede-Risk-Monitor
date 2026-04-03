# Crowd Risk Monitor: Review 2 Presentation Script

**Estimated Time:** 10-12 minutes
**Goal:** Tell the story of the project from the beginning to the current state, explaining the logic, the math, the technology, the roadblocks, and how we solved them.

---

## Slide 1: Introduction & Problem Statement
**(0:00 - 1:00)**

"Good morning everyone. Today I am presenting the Crowd Risk Monitor, a real-time AI-based stampede risk detection system. 

The problem we are solving is clear: crowd crushes and stampedes are tragic events that continue to happen at festivals, religious gatherings, and sporting events. 

Currently, event security relies on human operators staring at hundreds of CCTV screens. This is subjective, prone to fatigue, and completely reactive—meaning security usually only responds *after* an incident has already started. 

Our objective was to build a proactive system. An automated computer vision pipeline that can watch a camera feed, do the math locally, and instantly alert security to dangerous, localized pressure points in a crowd *before* the situation turns deadly."

## Slide 2: Project Objectives Recap
**(1:00 - 1:45)**

"Our core objective was real-time, automated detection. But an important breakthrough for us was realizing that simply counting people isn't enough to predict a stampede. 

Our main objective shifted to a **Dual-Factor Analysis**. We needed to measure both *Density*—how tightly packed the crowd is—and *Motion Chaos*—how erratically they are moving. We also needed to process these video feeds fast enough to provide a live, actionable dashboard with zero lag for the end-user."

## Slide 3: System Architecture
**(1:45 - 2:45)**

"Here is a look at the system architecture we built to achieve this.

It starts on the left with the User Input Layer—right now, that's uploading a video file for analysis. This feeds into our Web Server, which handles the frontend UI and the backend API.

The heavy lifting happens in the Computer Vision Processing block in the middle. We separate the frame processing into two distinct streams: Crowd Density Estimation and Motion Analysis. 

Finally, those two data streams converge into our Risk Estimation Engine, which fuses the data, applies our mathematical thresholds, and outputs the final Stampede Risk Level back to the browser's live dashboard."

## Slide 4: Implementation Details (Modules)
**(2:45 - 4:00)**

"So how did we actually implement this engine? We broke it down into four core Python modules that run sequentially on every frame.

**First is the Density Estimator.** It maps detected people to a physical grid. We implemented a mathematical concept called Exponential Moving Average (EMA) to smooth out the numbers. If our AI glitches and misses a person for a split second, the EMA acts like a shock absorber so our numbers don't jump wildly.

**Second is the Motion Chaos Analyzer.** This tracks movement at the pixel level.

**Third is the Risk Fusion Engine**, which is really the brain of the operation. It mathematically combines the density and motion grids, evaluates them against our safety limits, and categorizes every grid cell as Normal, Elevated, or Critical.

**Finally, the Web Dashboard** ties it all together, utilizing FastAPI on the backend to stream MJPEG frames directly to the browser alongside a live data feed."

## Slide 5: Implementation Details (Algorithms & Math)
**(4:00 - 6:00)**

"Let's dive into the actual algorithms and the math powering those modules.

For Density, we chose **YOLOv11 nano**. We specifically selected the 'nano' model to guarantee real-time FPS processing on standard hardware. The math here is simple: if a cell has a maximum capacity of 8 people, and YOLO detects 4, that cell has a Local Density of 0.5, or 50%.

For Motion, we used **Farneback Dense Optical Flow**. Unlike basic object tracking, Optical Flow calculates a velocity vector—an 'x' and 'y' speed—for *every single pixel* in the frame. We use Pythagorean theorem `sqrt(dx^2 + dy^2)` to calculate the exact speed magnitude of movement in that cell.

Then, the **Weighted Risk Fusion** algorithm takes over. It converts YOLO density and Optical Flow speed into a single Risk Score. 

The formula we settled on after extensive tuning is: `Risk = (Density * 0.70) + (Motion * 0.30)`. 

We weigh density higher because high-speed motion in an empty hallway isn't a stampede. But if density is extremely high, and the motion variance indicates chaotic, multi-directional movement—a panic indicator—we apply a 1.25x multiplier to the Risk Score to immediately trigger a critical alert."

## Slide 6: Code Snippet Showcase
**(6:00 - 6:30)**

"(Briefly gesture to the code snippet on screen)
Here is a simplified look at that exact Python logic. You can see we normalize the inputs, apply our 70/30 weighting, apply the chaos multiplier if a panic condition is met, and output the final constrained risk score between 0 and 100."

## Slide 7: Results & Analysis (75% Completion)
**(6:30 - 7:30)**

"As of Review 2, I am happy to report we have achieved 75% project completion. We have moved entirely away from simple test scripts and have a fully integrated, threaded web app. 

As you can see in these screenshots, the YOLO and Optical Flow pipelines successfully feed into our dashboard. We replaced chaotic bounding boxes with clean, localized grid zones that light up Red, Orange, or Green. The dashboard includes a live MJPEG video stream, real-time Chart.js tracking, and complete session summary analytics when the analysis ends."

## Slide 8: Technical Roadblocks & Solutions
**(7:30 - 9:00)**

"Getting to this point required overcoming three major technical roadblocks.

**Challenge 1 was Out of Memory Errors.** Farneback Optical Flow is incredibly memory-intensive. Running it on a 1080p video crashed the system. 
*The Solution:* We implemented a dynamic downscaling pipeline. Before calculating optical flow, we compress the frame to a maximum of 480 pixels wide, do the math, and then scale the vectors back up. This dropped our RAM usage from 4 Gigabytes to just 600 Megabytes with almost zero loss in macro-motion accuracy.

**Challenge 2 was UI Freezing.** Initially, the web server waited for YOLO to process a frame before responding to the browser, making the site unusable.
*The Solution:* We decoupled them. We run the Computer Vision loop in an isolated background Python thread. It crunches the numbers and updates a shared memory dictionary. The FastAPI web server simply reads that dictionary, allowing the webpage to remain highly responsive.

**Challenge 3 was Alarm Fatigue.** A grid cell hovering right on the edge of the 'Critical' threshold would rapidly flash red and orange, creating strobe-light annoyance.
*The Solution:* We coded a programmatic 'Hysteresis' buffer. If a cell triggers a Red alarm, our `region_history` module locks it in. It forces the alarm to stay active for at least 8 consecutive safe frames before downgrading back to Orange. This created a much more stable and professional user experience."

## Slide 9: Performance Metrics & Algorithmic Validation
**(9:00 - 10:00)**

"Because Stampede Risk isn't a binary 'yes/no' condition, we can't just report a flat '95% accuracy' like a simple image classifier. Instead, we validate our system through Computational Benchmarks and False Positive Reduction.

First, **Computational Benchmarks**: Running our dual-stream pipeline on a local laptop, we achieve a sustained 25-30 FPS. The dynamic downscaling for Optical Flow reduced RAM usage from 4.2 GB down to just 650 MB. And due to our threaded architecture, the latency delay between the camera capturing a frame and the dashboard updating is under 150 milliseconds.

Second, **Algorithmic Validation**: In crowd analysis, true accuracy is measured by eliminating false alarms. If we used YOLO alone, a dense but safe crowd standing in a queue would constantly trigger a 'CRITICAL' stampede alarm, making the system useless to security. We validate our accuracy by proving our Risk Fusion Engine safely suppresses these false positives. Only when the system receives high Density inputs AND chaotic Optical Flow variance does it output a Critical alert."

## Slide 10: Testing Scenarios & Outcomes
**(10:00 - 10:45)**

"We tested this logic against three real-world crowd scenarios. 

1. **Low-Density Walkway:** The system correctly identified green zones. The EMA bounding box smoothing prevented flickering.
2. **High-Density, Static Crowd (like a queue):** The system raised an 'Orange' warning for high density, but suppressed the 'Red' alarm because the Optical Flow confirmed the crowd was static and calm. This physically proved our dual-factor fusion works.
3. **Bottleneck / Crush Simulation:** The system saw high density combined with rapid, chaotic optical flow vectors, properly triggering a 'CRITICAL' alert within 2 seconds."

## Slide 11: Remaining Work & Future Scope
**(10:45 - 11:30)**

"For the final 25% of the project, we have three key deliverables:

First, **Database Integration**: We plan to implement SQLite to log these sessions, peak risk events, and timestamps for post-event review.

Second, **Alert Generation**: We want to add HTTP Webhooks to automatically send a Slack message or SMS to a security guard's phone the moment the Risk Score exceeds 85.

And finally—**A Dynamic Configuration Panel**. 
Currently, our thresholds (like the 70/30 weight or the maximum cell capacity) are hardcoded. We want to add sliders to the web dashboard so that an end-user can tweak and fine-tune these parameters for their specific camera angle or venue type, completely fundamentally changing the application's sensitivity without us having to alter the underlying AI code."

## Slide 12: Timeline for Completion
**(11:30 - 12:00)**

"To hit these final deliverables, we are currently in Week 1-2, polishing the UI and benchmarking. Over Weeks 3 and 4, we will finalize the database and implement the webhook notifications, leading into Week 5 for final integration testing before our final project hand-off in Week 6.

Thank you. I'm happy to take any questions or demonstrate the live system."
