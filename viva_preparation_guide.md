# 🧬 DNAAnalyzer: FYP Viva Preparation Guide

This document is designed to prepare you for the Internal Defense of your Final Year Project. It covers the most likely questions you will face, categorized by theme, with detailed justifications and recommended answers based on your specific implementation.

---

## 1. Project Overview & Motivation
**Focus:** Understanding the problem and your solution.

### Q1: What is the core problem your project addresses?
*   **Justification:** Examiners want to see if you understand the clinical/scientific significance of your work.
*   **Answer:** Genetic mutations (Single Nucleotide Variants - SNVs) can be benign or pathogenic (disease-causing). Manually classifying thousands of variations found in a patient's genome is slow and requires expert labor. DNAAnalyzer automates this by using a state-of-the-art Genomic Large Language Model (Evo2) to predict the harmfulness of these mutations instantly.

### Q2: Why did you choose the Evo2 model specifically over traditional methods?
*   **Justification:** Tests your knowledge of the state-of-the-art (SOTA).
*   **Answer:** Traditional methods (like SIFT or PolyPhen) often rely on evolutionary conservation or protein structure. Evo2 is a **Genomic Foundation Model** trained on 800 billion tokens across the tree of life. It understands the "grammar" of DNA (intrinsics, non-coding regions, and long-range dependencies) much better than previous models, allowing for more accurate zero-shot variant effect prediction.

---

## 2. Architecture & Technology Stack
**Focus:** The "How" of your implementation.

### Q3: Why did you choose a "Serverless GPU" (Modal) architecture instead of a traditional server?
*   **Justification:** Tests your architectural decision-making and cost-awareness.
*   **Answer:** The Evo2 7B model requires high-end hardware (NVIDIA H100 GPUs) and significant VRAM. Hosting such a server 24/7 is prohibitively expensive for a student project. By using **Modal**, we implemented a serverless architecture where the GPU only spins up when a request is made, providing high performance while keeping costs at zero/near-zero for low traffic.

### Q4: Explain the flow of a single variant analysis request.
*   **Justification:** Verifies you actually built the integration logic.
*   **Answer:** 
    1.  **Frontend:** User inputs a position and alternative base in the Next.js app.
    2.  **Backend (Modal):** The FastAPI endpoint receives the request.
    3.  **Data Fetching:** The backend fetches an 8192bp window of the reference genome from the **UCSC Genome Browser API**.
    4.  **Inference:** The Evo2 model scores two sequences: the original "reference" and the "mutated" sequence.
    5.  **Calculation:** We calculate the **Delta Likelihood Score** (Variant Score - Reference Score).
    6.  **Classification:** Based on a pre-calculated threshold, we classify it as Pathogenic or Benign and return the result + confidence score.

---

## 3. Machine Learning & Genomics
**Focus:** The science behind the predictions.

### Q5: How do you calculate the "Confidence" of your prediction?
*   **Justification:** Tests your understanding of statistical reliability.
*   **Answer:** We don't just give a label; we measure how "far" the delta score is from our decision threshold. We use the Standard Deviation (σ) of known pathogenic (LOF) and benign (FUNC) variants from a BRCA1 baseline dataset. If a score is many standard deviations away from the threshold, the confidence is high (approaching 1.0).

### Q6: What is a "Delta Likelihood Score"?
*   **Justification:** This is the core metric of your ML model.
*   **Answer:** Evo2 assigns a likelihood (probability) to any DNA sequence. A mutation changes that likelihood. The **Delta Score** is the log-likelihood difference. A significant *decrease* in likelihood usually indicates that the mutation disrupts a functional element of the DNA, suggesting pathogenicity.

---

## 4. Data & Integration
**Focus:** Where the data comes from and how you handle it.

### Q7: How do you validate your model's predictions?
*   **Justification:** Science requires validation against "Ground Truth."
*   **Answer:** We integrate with **ClinVar**, which is the industry-standard database for clinically observed variants. Users can search for a known variant, see its "ClinVar Classification" (Human-curated), and compare it directly with the "Evo2 Prediction" (AI-generated). This provides a real-world benchmark for the model's performance.

### Q8: What APIs are you using and why?
*   **Justification:** Tests your ability to work with external data sources.
*   **Answer:**
    *   **UCSC API:** To fetch the actual DNA sequences for any genomic coordinate (hg38/hg19).
    *   **NCBI E-utilities:** To fetch variant records and metadata from ClinVar for comparison.

---

## 5. Challenges & Future Scope
**Focus:** Critical thinking and growth.

### Q9: What was the biggest technical challenge you faced?
*   **Justification:** Shows your problem-solving skills.
*   **Answer:** *[Pick one you feel most comfortable with]*
    1.  **Environment Setup:** Getting the Evo2 model (which requires specific CUDA/PyTorch versions) to run inside a Modal container with proper GPU drivers.
    2.  **Data Volume:** Handling the massive size of genomic sequences and implementing efficient pagination (loading 100 variants at a time) for the ClinVar interface.
    3.  **Thresholding:** Determining a scientifically sound threshold to separate "benign" from "pathogenic" scores.

### Q10: How would you scale this for clinical use?
*   **Justification:** Tests your vision.
*   **Answer:** Currently, we analyze one variant at a time. To scale, I would implement **batch processing** (analyzing thousands of variants from a single VCF file), integrate more diverse datasets beyond BRCA1 to refine thresholds for different genes, and add support for **Indels** (Insertions/Deletions), which are more complex than the current SNVs (Single Nucleotide Variants).

---

## 💡 Top Tips for YOUR Defense:
1.  **Be Honest:** If you don't know a biological term, explain it from a "Computer Science" perspective (e.g., "DNA is a string of characters A, T, G, C").
2.  **Demo is King:** Your UI is high-end. Use it! Show the "Pathogenic" vs "Benign" comparison clearly.
3.  **Know your Threshold:** If they ask where `-0.000917` (from `main.py`) came from, tell them it was derived by finding the "Optimal Cutpoint" on a ROC curve using a verified BRCA1 dataset.

Good luck! 🚀
