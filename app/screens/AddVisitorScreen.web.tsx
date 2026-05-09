import React, { useState } from "react";
import styles from "./AddVisitorScreen.web.module.css";

export default function AddVisitorScreen() {
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");

  const handleAddVisitor = () => {
    if (
      !visitorName.trim() ||
      !visitorEmail.trim() ||
      !visitorPhone.trim() ||
      !visitPurpose.trim()
    ) {
      alert("Please fill in all fields");
      return;
    }
    alert("Visitor added successfully");
    setVisitorName("");
    setVisitorEmail("");
    setVisitorPhone("");
    setVisitPurpose("");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => window.history.back()}
        >
          ← Back
        </button>
        <h1 className={styles.title}>Add Visitor</h1>
        <div style={{ width: 24 }} />
      </div>

      <form className={styles.form}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Visitor Name</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Enter visitor name"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            className={styles.input}
            placeholder="Enter email address"
            value={visitorEmail}
            onChange={(e) => setVisitorEmail(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Phone Number</label>
          <input
            type="tel"
            className={styles.input}
            placeholder="Enter phone number"
            value={visitorPhone}
            onChange={(e) => setVisitorPhone(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Purpose of Visit</label>
          <textarea
            className={`${styles.input} ${styles.textArea}`}
            placeholder="Enter purpose of visit"
            rows={4}
            value={visitPurpose}
            onChange={(e) => setVisitPurpose(e.target.value)}
          />
        </div>

        <button
          type="button"
          className={styles.submitButton}
          onClick={handleAddVisitor}
        >
          Add Visitor
        </button>
      </form>
    </div>
  );
}
