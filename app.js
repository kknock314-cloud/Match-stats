import { db, auth } from "./firebase-config.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let allMatches = [], isAdmin = false, currentEditId = null;
const addModal = document.getElementById('addModal'), loginModal = document.getElementById('loginModal');
const matchForm = document.getElementById('matchForm'), loginForm = document.getElementById('loginForm');
const authBtn = document.getElementById('authBtn'), openModalBtn = document.getElementById('openModalBtn');

onAuthStateChanged(auth, (user) => {
    isAdmin = !!user;
    authBtn.innerText = isAdmin ? "Logout" : "Admin Login";
    openModalBtn.style.display = isAdmin ? "block" : "none";
    applyFiltersAndRender();
});

authBtn.addEventListener('click', () => { isAdmin ? signOut(auth) : loginModal.style.display = 'flex'; });
document.getElementById('closeLoginBtn').addEventListener('click', () => loginModal.style.display = 'none');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('loginError').innerText = "Logging in...";
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('adminEmail').value, document.getElementById('adminPassword').value);
        loginModal.style.display = 'none'; loginForm.reset(); document.getElementById('loginError').innerText = "";
    } catch (err) { document.getElementById('loginError').innerText = "Invalid credentials!"; }
});

onSnapshot(query(collection(db, "matches"), orderBy("createdAt", "desc")), (snapshot) => {
    allMatches = [];
    snapshot.forEach((doc) => { allMatches.push({ id: doc.id, ...doc.data() }); });
    updateFilterOptions(); applyFiltersAndRender();
});

openModalBtn.addEventListener('click', () => {
    currentEditId = null; matchForm.reset();
    document.getElementById('modalTitle').innerText = "Add Match Scorecard";
    document.getElementById('saveMatchBtn').innerText = "Save Scorecard";
    addModal.style.display = 'flex';
});

document.getElementById('closeModalBtn').addEventListener('click', () => addModal.style.display = 'none');
addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.style.display = 'none'; });

matchForm.addEventListener('submit', async (e) => {
    e.preventDefault(); if(!isAdmin) return alert("Please login first!");
    const btn = document.getElementById('saveMatchBtn'); btn.disabled = true; btn.innerText = "Saving...";
    
    const run1 = parseInt(document.getElementById('inn1Runs').value) || 0, run2 = parseInt(document.getElementById('inn2Runs').value) || 0;
    
    const team1Name = document.getElementById('team1').value.trim();
    const team2Name = document.getElementById('team2').value.trim();
    
    let winner = run1 > run2 ? `${team1Name} Won` : (run2 > run1 ? `${team2Name} Won (Chase)` : "Match Tied");
    
    const payload = {
        leagueType: document.getElementById('leagueType').value, format: document.getElementById('format').value,
        leagueName: document.getElementById('leagueName').value.trim(), 
        team1: team1Name, team2: team2Name,
        venue: document.getElementById('venue').value.trim(),
        pitchNo: document.getElementById('pitchNo').value.trim(), matchNo: document.getElementById('matchNo').value.trim(),
        inn1: { runs: run1, wkts: parseInt(document.getElementById('inn1Wkts').value)||0, overs: parseFloat(document.getElementById('inn1Overs').value)||0, pacers: parseInt(document.getElementById('inn1Pacers').value)||0, spinners: parseInt(document.getElementById('inn1Spinners').value)||0 },
        inn2: { runs: run2, wkts: parseInt(document.getElementById('inn2Wkts').value)||0, overs: parseFloat(document.getElementById('inn2Overs').value)||0, pacers: parseInt(document.getElementById('inn2Pacers').value)||0, spinners: parseInt(document.getElementById('inn2Spinners').value)||0 },
        winner: winner,
    };
    
    try {
        if (currentEditId) await updateDoc(doc(db, "matches", currentEditId), payload);
        else { payload.createdAt = serverTimestamp(); await addDoc(collection(db, "matches"), payload); }
        addModal.style.display = 'none'; matchForm.reset();
    } catch (err) { alert("Action failed."); } 
    finally { btn.disabled = false; btn.innerText = "Save Scorecard"; }
});

window.editMatch = (id) => {
    const m = allMatches.find(x => x.id === id); if(!m) return;
    currentEditId = id;
    document.getElementById('modalTitle').innerText = "Edit Scorecard";
    document.getElementById('saveMatchBtn').innerText = "Update";
    
    ['leagueType','format','leagueName','team1','team2','venue','pitchNo','matchNo'].forEach(k => {
        if(document.getElementById(k)) document.getElementById(k).value = m[k] || '';
    });
    
    ['Runs','Wkts','Overs','Pacers','Spinners'].forEach(k => {
        document.getElementById('inn1'+k).value = m.inn1[k.toLowerCase()];
        document.getElementById('inn2'+k).value = m.inn2[k.toLowerCase()];
    });
    addModal.style.display = 'flex';
};

window.deleteMatch = async (id) => { if(confirm("Delete this match?")) await deleteDoc(doc(db, "matches", id)); };

const searchInput = document.getElementById('searchInput');
const filterVenue = document.getElementById('filterVenue');
const filterFormat = document.getElementById('filterFormat');
const filterPitch = document.getElementById('filterPitch');
const filterTeam = document.getElementById('filterTeam');

[searchInput, filterVenue, filterFormat, filterPitch, filterTeam].forEach(el => 
    el.addEventListener(el.tagName==='INPUT'?'input':'change', applyFiltersAndRender)
);

function updateFilterOptions() {
    const vVal = filterVenue.value, pVal = filterPitch.value, tVal = filterTeam.value;
    
    const venues = [...new Set(allMatches.map(m => m.venue).filter(Boolean))];
    const pitches = [...new Set(allMatches.map(m => m.pitchNo).filter(Boolean))];
    const teams = [...new Set(allMatches.flatMap(m => [m.team1, m.team2]).filter(Boolean))];
    
    filterVenue.innerHTML = '<option value="All">All Venues</option>' + venues.map(v => `<option value="${v}">${v}</option>`).join('');
    filterPitch.innerHTML = '<option value="All">All Pitches</option>' + pitches.map(p => `<option value="${p}">${p}</option>`).join('');
    filterTeam.innerHTML = '<option value="All">All Teams</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
    
    if (venues.includes(vVal)) filterVenue.value = vVal;
    if (pitches.includes(pVal)) filterPitch.value = pVal;
    if (teams.includes(tVal)) filterTeam.value = tVal;
}

function applyFiltersAndRender() {
    const s = searchInput.value.toLowerCase().trim();
    const v = filterVenue.value, f = filterFormat.value, p = filterPitch.value, t = filterTeam.value;
    
    const filtered = allMatches.filter(m => 
        (`${m.leagueName||''} ${m.venue||''} Match ${m.matchNo||''} ${m.team1||''} ${m.team2||''}`.toLowerCase().includes(s)) &&
        (v === 'All' || m.venue === v) && 
        (f === 'All' || m.format === f) &&
        (p === 'All' || m.pitchNo === p) &&
        (t === 'All' || m.team1 === t || m.team2 === t)
    );
    updateStats(filtered); renderList(filtered);
}

function updateStats(matches) {
    let t = matches.length, r1=0, r2=0, w1=0, w2=0, p=0, s=0;
    if (t === 0) return ['avg1stScore','avg2ndScore','avg1stWkts','avg2ndWkts','avgPacers','avgSpinners'].forEach(id => document.getElementById(id).textContent = '0');
    matches.forEach(m => { r1+=m.inn1?.runs||0; r2+=m.inn2?.runs||0; w1+=m.inn1?.wkts||0; w2+=m.inn2?.wkts||0; p+=(m.inn1?.pacers||0)+(m.inn2?.pacers||0); s+=(m.inn1?.spinners||0)+(m.inn2?.spinners||0); });
    document.getElementById('avg1stScore').textContent = Math.round(r1/t); document.getElementById('avg2ndScore').textContent = Math.round(r2/t);
    document.getElementById('avg1stWkts').textContent = (w1/t).toFixed(1); document.getElementById('avg2ndWkts').textContent = (w2/t).toFixed(1);
    document.getElementById('avgPacers').textContent = (p/t).toFixed(1); document.getElementById('avgSpinners').textContent = (s/t).toFixed(1);
}

function renderList(matches) {
    const c = document.getElementById('matchList');
    if (matches.length === 0) return c.innerHTML = '<p class="empty-state">No matches found.</p>';
    c.innerHTML = matches.map(m => `
        <div class="match-card">
            <div class="match-card-header">
                <span><strong>${m.team1 || 'Team 1'} vs ${m.team2 || 'Team 2'}</strong></span>
            </div>
            <div class="match-card-sub">
                <span>${m.leagueName} (Match #${m.matchNo})</span>
                <span>${m.venue} (${m.pitchNo||'Pitch'})</span>
            </div>
            <div class="match-scores"><div>1st: ${m.inn1?.runs}/${m.inn1?.wkts} (${m.inn1?.overs} ov)</div><div>2nd: ${m.inn2?.runs}/${m.inn2?.wkts} (${m.inn2?.overs} ov)</div></div>
            <div class="match-footer">🏆 ${m.winner||'Result Decided'}</div>
            <div class="admin-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
                <button class="btn-edit" onclick="editMatch('${m.id}')">✏️ Edit</button><button class="btn-delete" onclick="deleteMatch('${m.id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}
