// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";



// ================= FIREBASE CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyAbcW3SB225wp8jRPTWqKpmMmRIBrM0J7k",
    authDomain: "cloud-todo-app-c6a62.firebaseapp.com",
    projectId: "cloud-todo-app-c6a62",
    storageBucket: "cloud-todo-app-c6a62.firebasestorage.app",
    messagingSenderId: "1031752845064",
    appId: "1:1031752845064:web:158fdade3fe23b9f2b4ebd"
};



// ================= INITIALIZE =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ================= DOM ELEMENTS =================
const email = document.getElementById("email");
const password = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.querySelector(".logout-btn");

const authCard = document.getElementById("authCard");
const appContent = document.getElementById("appContent");

const taskInput = document.getElementById("taskInput");
const taskDateTime = document.getElementById("taskDateTime");
const addBtn = document.getElementById("addBtn");
const taskList = document.getElementById("taskList");


// ================= NOTIFICATION PERMISSION =================
async function requestNotificationPermission() {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
        await Notification.requestPermission();
    }
}




// ================= AUTH =================

// Register
registerBtn.addEventListener("click", async () => {
    if (!email.value || !password.value) {
        alert("Enter email and password");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email.value, password.value);
        alert("Registration successful");
    } catch (error) {
        alert(error.message);
    }
});

// Login
loginBtn.addEventListener("click", async () => {
    if (!email.value || !password.value) {
        alert("Enter email and password");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email.value, password.value);

        if ("Notification" in window && Notification.permission === "default") {
            await Notification.requestPermission();
        }

        alert("Login successful");
    } catch (error) {
        alert(error.message);
    }
});

// Logout
logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
});


// ================= AUTH STATE =================
let unsubscribeTasks = null;

onAuthStateChanged(auth, (user) => {

    if (user) {
        authCard.style.display = "none";
        appContent.style.display = "block";
        loadTasks(user.uid);
    } else {
        authCard.style.display = "block";
        appContent.style.display = "none";
        taskList.innerHTML = "";

        if (unsubscribeTasks) {
            unsubscribeTasks();
            unsubscribeTasks = null;
        }
    }

});


// ================= REMINDER SYSTEM =================
const notifiedTasks = new Set();

function checkReminder(taskId, taskData) {

    if (!taskData.dueTime) return;
    if (taskData.completed) return;
    if (Notification.permission !== "granted") return;

    const dueTime = new Date(taskData.dueTime);
    const now = new Date();

    if (isNaN(dueTime)) return;

    const diffMs = dueTime - now;
    const diffMinutes = diffMs / (1000 * 60);

    if (diffMinutes <= 10 && diffMinutes > 0) {

        if (!notifiedTasks.has(taskId)) {

            new Notification("Reminder: Task due soon", {
                body: `${taskData.title} is due at ${dueTime.toLocaleTimeString()}`
            });

            notifiedTasks.add(taskId);
        }
    }
}


// ================= ADD TASK =================
addBtn.addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user) {
        alert("Login required.");
        return;
    }

    const title = taskInput.value.trim();
    const dueTime = taskDateTime.value;

    if (!title || !dueTime) {
        alert("Enter task and date/time.");
        return;
    }

    try {

        const userTasksRef = collection(db, "users", user.uid, "tasks");

        await addDoc(userTasksRef, {
            title: title,
            dueTime: dueTime,
            completed: false,
            remarks: "", // 👈 new field
            createdAt: serverTimestamp()
        });

        taskInput.value = "";
        taskDateTime.value = "";

    } catch (error) {
        alert(error.message);
    }

});


// ================= LOAD TASKS =================
function loadTasks(uid) {

    const tasksRef = collection(db, "users", uid, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {

        taskList.innerHTML = "";

        snapshot.forEach((docSnap) => {

            const task = docSnap.data();
            const taskId = docSnap.id;

            // 🔔 Immediate reminder check
            checkReminder(taskId, task);

            const li = document.createElement("li");
            li.className = "task-item";
            li.dataset.taskId = taskId;
            li.dataset.dueTime = task.dueTime;
            li.dataset.title = task.title;
            li.dataset.completed = task.completed;

            // Checkbox
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = task.completed;

            checkbox.addEventListener("change", async () => {
                await updateDoc(doc(db, "users", uid, "tasks", taskId), {
                    completed: checkbox.checked
                });
            });

            // Content
            const content = document.createElement("div");
            content.className = "task-content";

            const titleEl = document.createElement("span");
            titleEl.textContent = task.title;

            const timeEl = document.createElement("small");
            timeEl.textContent = new Date(task.dueTime).toLocaleString();

            if (task.completed) {
                titleEl.classList.add("completed");
            }

            content.appendChild(titleEl);
            content.appendChild(timeEl);

            if (task.remarks) {
                const remarksEl = document.createElement("small");
                remarksEl.textContent = `Remark: ${task.remarks}`;
                remarksEl.style.display = "block";
                remarksEl.style.color = "gray";
                content.appendChild(remarksEl);
            }

            // Delete
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className = "delete-btn";

            deleteBtn.addEventListener("click", async () => {
                await deleteDoc(doc(db, "users", uid, "tasks", taskId));
                notifiedTasks.delete(taskId);
            });

            // ================= REMARKS BUTTON =================
            const remarksBtn = document.createElement("button");
            remarksBtn.textContent = "📝";
            remarksBtn.className = "remarks-btn";

            remarksBtn.addEventListener("click", async () => {

                if (!checkbox.checked) {
                    alert("Complete the task before adding remarks.");
                    return;
                }

                const existingRemark = task.remarks || "";
                const userRemark = prompt("Enter your remarks:", existingRemark);

                if (userRemark !== null) {
                    await updateDoc(doc(db, "users", uid, "tasks", taskId), {
                        remarks: userRemark
                    });
                }
            });


            // Append in correct order
            li.appendChild(checkbox);
            li.appendChild(content);
            li.appendChild(remarksBtn);
            li.appendChild(deleteBtn);

            taskList.appendChild(li);

        });

    });
}


// ================= CONTINUOUS REMINDER CHECK =================
setInterval(() => {

    const taskItems = document.querySelectorAll(".task-item");

    taskItems.forEach(item => {

        const taskId = item.dataset.taskId;
        const dueTime = item.dataset.dueTime;
        const title = item.dataset.title;
        const completed = item.querySelector("input").checked;

        checkReminder(taskId, {
            title,
            dueTime,
            completed
        });

    });

}, 30000); // every 30 seconds

const footerText = document.getElementById("footerText");
const currentYear = new Date().getFullYear();
footerText.textContent = `© ${currentYear} Vinothraj, Software Developer | vinoloke1973@gmail.com`;