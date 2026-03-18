# 💸 MisGastos

App de gastos compartidos en tiempo real con Firebase. PWA instalable en iPhone.

## Funcionalidades
- 🔐 Login / Registro con email
- 🏠 Grupos con código de invitación
- 💳 Añadir gastos con categoría
- ⚖️ Cálculo automático de deudas
- 📅 Resumen mensual por categoría
- 🔄 Sincronización en tiempo real

---

## Instalación local

```bash
npm install
npm start
```

---

## Deploy en Vercel

```bash
# 1. Sube a GitHub
git init
git add .
git commit -m "feat: MisGastos inicial"
git remote add origin https://github.com/TU_USUARIO/misgastos.git
git push -u origin main

# 2. Ve a vercel.com → New Project → importa el repo → Deploy
```

---

## ⚠️ Reglas de Firestore (IMPORTANTE)

Ve a Firebase Console → Firestore → Pestaña **Reglas** y pega esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /groups/{groupId} {
      allow read: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth.uid in resource.data.members;
      
      match /expenses/{expenseId} {
        allow read, write: if request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
      }
    }
  }
}
```

---

## Instalar en iPhone como PWA

1. Abre la URL en **Safari**
2. Pulsa **Compartir ↑** → "Añadir a pantalla de inicio"
3. ¡Listo! 🎉
