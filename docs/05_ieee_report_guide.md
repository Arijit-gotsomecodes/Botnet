# 📝 IEEE Report Writing Guide

> **Note to the team:** This is your skeleton outline for the final report. You can map the sections from the other `.md` files directly into these IEEE sections.

## Title ideas
*   *Cloud-SOC: A Scalable Hybrid-Cloud Dashboard for Real-Time IoT Malware Detection using Machine Learning*
*   *Performance Analysis of Ensemble and Deep Learning Models for IoT Intrusion Detection in Cloud Environments*

## I. Introduction
*   **Context:** Start by explaining the massive growth of IoT devices and how vulnerable they are to malware (botnets).
*   **Problem:** Manual traffic inspection is impossible due to data volume (mention Throughput).
*   **Solution:** Propose our Cloud-SOC Dashboard. State clearly that we evaluate RF, XGB, and NN on the IoT-23 dataset, deployed in a simulated hybrid cloud architecture.
*   **(Use `docs/01_project_overview.md`)**

## II. Related Work
*   *You guys will need to look up 3-4 papers on Google Scholar mentioning "IoT-23 Intrusion Detection" and summarize what others did.*

## III. System Architecture
*   Explain the Client-Server split (React Frontend -> FastAPI Backend).
*   Include the Mermaid Flow Diagram here!
*   Explain the paradigms: How our system demonstrates Latency monitoring, Throughput streaming via SSE, and theoretical Scalability metrics on AWS.
*   **(Use `docs/04_system_architecture.md`)**

## IV. Methodology & Data Processing
*   **Dataset:** Introduce the IoT-23 dataset and the exact size of the sample (`dev_scale`) we used. (Look at the Data Pipeline page in the dashboard for exact numbers).
*   **Preprocessing:** Explain dealing with missing values (`-`), dropping non-essential IPs, and Label Encoding. 
*   **Feature Selection:** List the 11 features we extracted (duration, bytes, proto, etc.) and explain *why*.
*   **(Use `docs/02_data_processing.md`)**

## V. Machine Learning Models
*   Explain the three models (Random Forest, XGBoost, MLP Neural Network).
*   Write a tiny bit about the math/concept behind each (Trees vs Neurons).
*   Explain the Training/Validation/Test split strategy.
*   Discuss Explainable AI (XAI) and why we use SHAP to build trust in our black-box models.
*   **(Use `docs/03_machine_learning_models.md`)**

## VI. Results and Discussion
*   Take screenshots of the **Model Performance** page from the dashboard!
*   Put the Confusion Matrices and ROC curves here alongside a table of the final F1 scores.
*   Discuss the tradeoff: RF and XGBoost are usually faster (less latency) than deep neural nets, making them better for real-time Cloud-SOC throughput.

## VII. Conclusion
*    Summarize that ML is highly effective for IoT intrusion detection. State that the cloud-delivered dashboard successfully visualizes complex ML inferences and SHAP values in real-time, fulfilling the requirements for a scalable, low-latency Cloud ML architecture.
