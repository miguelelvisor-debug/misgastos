# 💸 MisGastos

App de gastos compartidos en tiempo real con Firebase. PWA instalable en iPhone.

## Funcionalidades
- 🔐 Login / Registro con email
- 🏠 Grupos con código de invitación
- 💳 Añadir y **editar** gastos con categoría
- ⚖️ Cálculo automático de deudas
- ✅ **Marcar deudas como saldadas** (con historial y opción de deshacer)
- 📅 Resumen mensual por categoría
- 🔄 Sincronización en tiempo real

---

## ⚠️ Reglas de Firestore (IMPORTANTE — actualizar)

Ve a Firebase Console → Firestore → Pestaña **Reglas** y pega esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /groups/{groupId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      match /expenses/{expenseId} {
        allow read, write: if request.auth.uid in
          get(/databases/$(database)/documents/groups/$(groupId)).data.members;
      }
      match /settlements/{settlementId} {
        allow read, write: if request.auth.uid in
          get(/databases/$(database)/documents/groups/$(groupId)).data.members;
      }
    }
  }
}
```

---

## Deploy en Vercel

```bash
git add . && git commit -m "feat: edit expenses + settle debts" && git push
```

---

## Instalar en iPhone como PWA

1. Abre la URL en **Safari**
2. Pulsa **Compartir ↑** → "Añadir a pantalla de inicio"
