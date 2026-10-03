import { db, auth } from "./firebase-config.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let allMatches = [], isAdmin = false, currentEditId = null;
const addModal = document.getElementById('addModal'), loginModal = document.getElementById('loginModal');
const matchForm = document.getElementById('matchForm'), loginForm = document.getElementById('loginForm');
const authBtn = document.getElementById('authBtn'), openModalBtn = document.getElementById('openModalBtn');

// -------------------------------------------------------------
// SMART DICTIONARY (ALIAS MAPPING)
// -------------------------------------------------------------
const aliases = {
    "mi": "mumbai indians",
    "csk": "chennai super kings",
    "rcb": "royal challengers bangalore",
    "kkr": "kolkata knight riders",
    "srh": "sunrisers hyderabad",
    "dc": "delhi capitals",
    "pbks": "punjab kings",
    "rr": "rajasthan royals",
    "lsg": "lucknow super giants",
    "gt": "gujarat titans",
    "ind": "india",
    "pak": "pakistan",
    "aus": "australia",
    "eng": "england",
    "sa": "south africa",
    "nz": "new zealand",
    "wi": "west indies",
    "sl": "sri lanka",
    "ban": "bangladesh",
    "afg": "afghanistan",
    "wpl": "womens premier league",
    "ipl": "indian premier league"
};

function getExpandedSearchTerms(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    const terms = [q];
    if (aliases[q]) terms.push(aliases[q].toLowerCase());
    Object.keys(aliases).forEach(key => {
        if (aliases[key].toLowerCase().includes(q)) {
            terms.push(key);
        }
    });
    return terms;
}
// -------------------------------------------------------------

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
    updateFilterOptions(); 
    applyFiltersAndRender();
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
    
    const run1 = parseInt(document.getElementById('inn1Runs').value) || 0;
    const run2 = parseInt(document.getElementById('inn2Runs').value) || 0;
    const team1Name = document.getElementById('team1').value.trim() || "Team 1";
    const team2Name = document.getElementById('team2').value.trim() || "Team 2";
    
    let winner = "Result Pending";
    if (run1 > run2) winner = `${team1Name} Won`;
    else if (run2 > run1) winner = `${team2Name} Won (Chase)`;
    else if (run1 > 0 && run1 === run2) winner = "Match Tied";
    
    const payload = {
        leagueType: document.getElementById('leagueType').value, format: document.getElementById('format').value,
        leagueName: document.getElementById('leagueName').value.trim() || 'Unknown League', 
        team1: team1Name, team2: team2Name,
        venue: document.getElementById('venue').value.trim() || 'Unknown Venue',
        pitchNo: document.getElementById('pitchNo').value.trim() || '-', 
        matchNo: document.getElementById('matchNo').value.trim() || '-',
        inn1: { 
            runs: run1, 
            wkts: parseInt(document.getElementById('inn1Wkts').value)||0, 
            overs: parseFloat(document.getElementById('inn1Overs').value)||0, 
            pacers: parseInt(document.getElementById('inn1Pacers').value)||0, 
            spinners: parseInt(document.getElementById('inn1Spinners').value)||0 
        },
        inn2: { 
            runs: run2, 
            wkts: parseInt(document.getElementById('inn2Wkts').value)||0, 
            overs: parseFloat(document.getElementById('inn2Overs').value)||0, 
            pacers: parseInt(document.getElementById('inn2Pacers').value)||0, 
            spinners: parseInt(document.getElementById('inn2Spinners').value)||0 
        },
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
        if(document.getElementById(k)) document.getElementById(k).value = m[k] === '-' || m[k] === 'Unknown League' || m[k] === 'Unknown Venue' || m[k] === 'Team 1' || m[k] === 'Team 2' ? '' : m[k];
    });
    
    ['Runs','Wkts','Overs','Pacers','Spinners'].forEach(k => {
        document.getElementById('inn1'+k).value = m.inn1[k.toLowerCase()] || '';
        document.getElementById('inn2'+k).value = m.inn2[k.toLowerCase()] || '';
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

// Smart Dropdown / Searchable Select with Edit/Delete
function setupSmartDropdown(inputId, listId, fieldType, dataExtractor) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    
    const renderList = (queryVal) => {
        let suggestions = [...new Set(allMatches.map(dataExtractor).flat().filter(item => 
            item && item !== 'Unknown League' && item !== 'Unknown Venue' && item !== '-' && item !== 'Team 1' && item !== 'Team 2'
        ))];
        
        if (queryVal) {
            const searchTerms = getExpandedSearchTerms(queryVal);
            suggestions = suggestions.filter(item => {
                const itemLow = item.toLowerCase();
                return searchTerms.some(term => itemLow.includes(term));
            });
        }
        
        list.innerHTML = '';
        if (suggestions.length === 0) { list.style.display = 'none'; return; }
        
        suggestions.forEach(item => {
            const li = document.createElement('li');
            
            const span = document.createElement('span');
            span.className = 'item-text';
            span.textContent = item;
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = item;
                list.style.display = 'none';
            });
            li.appendChild(span);
            
            if (isAdmin) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'item-actions';
                
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'btn-item-action';
                editBtn.textContent = '✏️';
                editBtn.title = 'Rename in all matches';
                editBtn.addEventListener('mousedown', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newName = prompt(`Rename '${item}' to:`, item);
                    if (newName && newName.trim() && newName.trim() !== item) {
                        await renameFieldGlobally(fieldType, item, newName.trim());
                    }
                });
                
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'btn-item-action del';
                delBtn.textContent = '🗑️';
                delBtn.title = 'Remove from matches';
                delBtn.addEventListener('mousedown', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Remove '${item}' from existing records?`)) {
                        await deleteFieldGlobally(fieldType, item);
                    }
                });
                
                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(delBtn);
                li.appendChild(actionsDiv);
            }
            list.appendChild(li);
        });
        list.style.display = 'block';
    };

    input.addEventListener('focus', () => renderList(input.value.trim()));
    input.addEventListener('input', () => renderList(input.value.trim()));
    input.addEventListener('blur', () => { setTimeout(() => list.style.display = 'none', 250); });
}

// Global Rename & Delete
async function renameFieldGlobally(fieldType, oldVal, newVal) {
    try {
        const matchesToUpdate = allMatches.filter(m => {
            if (fieldType === 'leagueName') return m.leagueName === oldVal;
            if (fieldType === 'venue') return m.venue === oldVal;
            if (fieldType === 'team') return m.team1 === oldVal || m.team2 === oldVal;
            return false;
        });
        
        for (const m of matchesToUpdate) {
            let updatePayload = {};
            if (fieldType === 'leagueName') updatePayload.leagueName = newVal;
            if (fieldType === 'venue') updatePayload.venue = newVal;
            if (fieldType === 'team') {
                if (m.team1 === oldVal) updatePayload.team1 = newVal;
                if (m.team2 === oldVal) updatePayload.team2 = newVal;
            }
            await updateDoc(doc(db, "matches", m.id), updatePayload);
        }
    } catch(err) { alert("Failed to update: " + err.message); }
}

async function deleteFieldGlobally(fieldType, val) {
    try {
        const matchesToUpdate = allMatches.filter(m => {
            if (fieldType === 'leagueName') return m.leagueName === val;
            if (fieldType === 'venue') return m.venue === val;
            if (fieldType === 'team') return m.team1 === val || m.team2 === val;
            return false;
        });
        
        for (const m of matchesToUpdate) {
            let updatePayload = {};
            if (fieldType === 'leagueName') updatePayload.leagueName = '-';
            if (fieldType === 'venue') updatePayload.venue = '-';
            if (fieldType === 'team') {
                if (m.team1 === val) updatePayload.team1 = '-';
                if (m.team2 === val) updatePayload.team2 = '-';
            }
            await updateDoc(doc(db, "matches", m.id), updatePayload);
        }
    } catch(err) { alert("Failed to delete: " + err.message); }
}

setupSmartDropdown('leagueName', 'leagueList', 'leagueName', m => m.leagueName);
setupSmartDropdown('venue', 'venueList', 'venue', m => m.venue);
setupSmartDropdown('team1', 'team1List', 'team', m => [m.team1, m.team2]);
setupSmartDropdown('team2', 'team2List', 'team', m => [m.team1, m.team2]);

function updateFilterOptions() {
    const vVal = filterVenue.value, pVal = filterPitch.value, tVal = filterTeam.value;
    
    const venues = [...new Set(allMatches.map(m => m.venue).filter(v => v && v !== 'Unknown Venue' && v !== '-'))];
    const pitches = [...new Set(allMatches.map(m => m.pitchNo).filter(p => p && p !== '-'))];
    const teams = [...new Set(allMatches.flatMap(m => [m.team1, m.team2]).filter(t => t && t !== 'Team 1' && t !== 'Team 2' && t !== '-'))];
    
    filterVenue.innerHTML = '<option value="All">All Venues</option>' + venues.map(v => `<option value="${v}">${v}</option>`).join('');
    filterPitch.innerHTML = '<option value="All">All Pitches</option>' + pitches.map(p => `<option value="${p}">${p}</option>`).join('');
    filterTeam.innerHTML = '<option value="All">All Teams</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
    
    if (venues.includes(vVal)) filterVenue.value = vVal;
    if (pitches.includes(pVal)) filterPitch.value = pVal;
    if (teams.includes(tVal)) filterTeam.value = tVal;
}

function applyFiltersAndRender() {
    const s = searchInput.value.toLowerCase().trim();
    const searchTerms = getExpandedSearchTerms(s);
    
    const v = filterVenue.value, f = filterFormat.value, p = filterPitch.value, t = filterTeam.value;
    
    const filtered = allMatches.filter(m => {
        const matchStr = (`${m.leagueName||''} ${m.venue||''} Match ${m.matchNo||''} ${m.team1||''} ${m.team2||''}`).toLowerCase();
        
        // Match ANY of the expanded search terms
        const matchesSearch = searchTerms.length === 0 || searchTerms.some(term => matchStr.includes(term));
        
        const matchesVenue = (v === 'All' || m.venue === v);
        const matchesFormat = (f === 'All' || m.format === f);
        const matchesPitch = (p === 'All' || m.pitchNo === p);
        const matchesTeam = (t === 'All' || m.team1 === t || m.team2 === t);
        
        return matchesSearch && matchesVenue && matchesFormat && matchesPitch && matchesTeam;
    });
    
    updateStats(filtered); 
    renderList(filtered);
}

function updateStats(matches) {
    let t = matches.length;
    let r1=0, r2=0, w1=0, w2=0, p1=0, s1=0, p2=0, s2=0;
    let win1st = 0, win2nd = 0, totalDecided = 0;
    
    if (t === 0) {
        ['avg1stScore','avg2ndScore','avg1stWkts','avg2ndWkts','avg1stPacers','avg1stSpinners','avg2ndPacers','avg2ndSpinners'].forEach(id => document.getElementById(id).textContent = '0');
        document.getElementById('win1stPct').textContent = '0%';
        document.getElementById('win2ndPct').textContent = '0%';
        return;
    }
    
    matches.forEach(m => { 
        r1+=m.inn1?.runs||0; r2+=m.inn2?.runs||0; 
        w1+=m.inn1?.wkts||0; w2+=m.inn2?.wkts||0; 
        p1+=(m.inn1?.pacers||0); s1+=(m.inn1?.spinners||0);
        p2+=(m.inn2?.pacers||0); s2+=(m.inn2?.spinners||0);
        
        if (m.winner && m.winner.includes("Won")) {
            totalDecided++;
            if (m.winner.includes("(Chase)")) win2nd++;
            else win1st++;
        }
    });
    
    document.getElementById('avg1stScore').textContent = Math.round(r1/t); 
    document.getElementById('avg2ndScore').textContent = Math.round(r2/t);
    document.getElementById('avg1stWkts').textContent = (w1/t).toFixed(1); 
    document.getElementById('avg2ndWkts').textContent = (w2/t).toFixed(1);
    document.getElementById('avg1stPacers').textContent = (p1/t).toFixed(1); 
    document.getElementById('avg1stSpinners').textContent = (s1/t).toFixed(1);
    document.getElementById('avg2ndPacers').textContent = (p2/t).toFixed(1); 
    document.getElementById('avg2ndSpinners').textContent = (s2/t).toFixed(1);
    
    let w1Pct = totalDecided > 0 ? Math.round((win1st / totalDecided) * 100) : 0;
    let w2Pct = totalDecided > 0 ? Math.round((win2nd / totalDecided) * 100) : 0;
    document.getElementById('win1stPct').textContent = w1Pct + '%';
    document.getElementById('win2ndPct').textContent = w2Pct + '%';
}

function renderList(matches) {
    const c = document.getElementById('matchList');
    const toggleBtn = document.getElementById('toggleHistoryBtn');
    
    if (matches.length === 0) {
        c.innerHTML = '<p class="empty-state">No matches found.</p>';
        toggleBtn.style.display = 'none';
        return;
    }
    
    const createCard = (m) => `
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
    `;

    if (matches.length <= 2) {
        c.innerHTML = matches.map(createCard).join('');
        toggleBtn.style.display = 'none';
    } else {
        const visibleHtml = matches.slice(0, 2).map(createCard).join('');
        const hiddenHtml = matches.slice(2).map(createCard).join('');
        
        c.innerHTML = `
            ${visibleHtml}
            <div id="hiddenLayer" class="hidden-layer">${hiddenHtml}</div>
        `;
        
        toggleBtn.style.display = 'block';
        toggleBtn.innerText = 'Show All Matches ⬇️';
        
        toggleBtn.onclick = function() {
            const hiddenLayer = document.getElementById('hiddenLayer');
            if (hiddenLayer.style.display === 'flex') {
                hiddenLayer.style.display = 'none';
                toggleBtn.innerText = 'Show All Matches ⬇️';
            } else {
                hiddenLayer.style.display = 'flex';
                toggleBtn.innerText = 'Hide Matches ⬆️';
            }
        };
    }
}
