# Post-Production Plan

## Overview
This document outlines the essential steps and strategies to follow chronologically after the application enters a production environment. Adhering to these steps ensures security, minimal downtime, and continuous growth.

## 1. Security & Compliance
- **Firebase Security Rules**: Ensure `firestore.rules` is strictly locked down and only the necessary fields are whitelisted for interaction. Conduct periodic red-team testing to discover new loopholes.
- **Paystack Webhooks**: Ensure Paystack is securely returning webhook events directly to your deployed endpoint. Use an explicit webhook signature validation on the backend.
- **API Rate Limiting**: Keep the Express Rate Limiter in `server.ts` active and tune limits according to real-world usage. Currently, it is set to `100` requests per `15` minutes per IP.
- **Environment Secrets**: Only distribute production environment secrets (`JWT_SECRET`, `PAYSTACK_SECRET`, `FIREBASE_SERVICE_ACCOUNT`) securely through the Cloud Run configuration UI (managed via Google Cloud Secrets Manager) or your CI/CD pipelines. Ensure production never runs with default or placeholder string values.

## 2. CI/CD & Deployment
- **Automated Deployments**: Implement GitHub Actions, GitLab CI, or Google Cloud Build to trigger tests and automatic builds when pushing to the main branch. 
- **Rollback Strategy**: Maintain a quick deployment rollback pipeline on Google Cloud Run. By default, Cloud Run saves container revisions, allowing one-click rollback if new updates introduce critical bugs.

## 3. Database & Sync
- **Data Backups**: Utilize Google Cloud's Scheduled Backups for Firestore or rely on Point-In-Time Recovery (PITR) to restore accidentally deleted documents.
- **Sync Optimization**: The offline-first architecture currently uses `dexie` and streams live differences using Firestore snapshots. Monitor Firebase reads carefully so free-tier quotas (`50,000` reads/day) are not unnecessarily exhausted by client devices downloading changes frequently.

## 4. Monitoring & Error Tracking
- **Sentry/Datadog**: Implement a system outside of basic `console.error` logs to trap and analyze front-end and back-end exceptions.
- **Cloud Logging**: Utilize Google Cloud Logging attached to Cloud Run container logs. Periodically check logs for failed Paystack verifications or unauthorized connection attempts.

## 5. Scalability & Maintenance
- **Database Archiving**: Determine a schedule (every 6 or 12 months) to move historical transactions and older milk collections to an archive sub-collection or Google Cloud storage bucket to reduce document load.
- **User Management**: Have a strict operational protocol for handling user status (e.g., automatically archiving unverified accounts, resolving "PENDING" approvals).
