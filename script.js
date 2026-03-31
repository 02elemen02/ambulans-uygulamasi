document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTLER ---
    const datetimeDisplay = document.getElementById('datetimeDisplay');
    const firebaseStatus = document.getElementById('firebaseStatus');
    const connectSerialBtn = document.getElementById('connectSerialBtn');
    const serialStatusText = document.getElementById('serialStatusText');
    const terminalOutput = document.getElementById('terminalOutput');
    const debugTerminal = document.getElementById('debugTerminal');
    const closeTerminal = document.getElementById('closeTerminal');
    const toggleTerminal = document.getElementById('toggleTerminal');
    
    // Telemetri
    const batteryVolt = document.getElementById('batteryVolt');
    const solarVolt = document.getElementById('solarVolt');
    const temperature = document.getElementById('temperature');
    const cleanWaterLevel = document.getElementById('cleanWaterLevel');
    const cleanWaterBar = document.getElementById('cleanWaterBar');
    const dirtyWaterLevel = document.getElementById('dirtyWaterLevel');
    const dirtyWaterBar = document.getElementById('dirtyWaterBar');

    // --- DURUM DEĞİŞKENLERİ ---
    let lastLampsState = {};
    window.arduinoWriter = null;
    let keepReading = true;
    let reader;

    // --- TARİH VE SAAT ---
    function updateDateTime() {
        if (!datetimeDisplay) return;
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        datetimeDisplay.innerText = now.toLocaleDateString('tr-TR', options);
    }
    setInterval(updateDateTime, 1000);
    updateDateTime();

    // --- TERMİNAL FONKSİYONLARI ---
    function logToTerminal(msg, type = 'info') {
        if (!terminalOutput) return;
        const time = new Date().toLocaleTimeString('tr-TR');
        const line = document.createElement('div');
        line.style.color = type === 'error' ? '#ff4757' : (type === 'success' ? '#2ed573' : '#0f0');
        line.innerText = `[${time}] ${msg}`;
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        
        // Konsola da yaz
        if (type === 'error') console.error(msg);
        else console.log(msg);
    }

    if(toggleTerminal) toggleTerminal.addEventListener('click', () => debugTerminal.classList.toggle('hidden'));
    if(closeTerminal) closeTerminal.addEventListener('click', () => debugTerminal.classList.add('hidden'));

    // --- FIREBASE KURULUMU ---
    function updateFirebaseUI(status, message) {
        if (!firebaseStatus) return;
        const dot = firebaseStatus.querySelector('.status-dot');
        const text = firebaseStatus.querySelector('.status-text');
        
        dot.className = 'status-dot ' + status;
        text.innerText = message;
        
        if (status === 'offline') logToTerminal("Firebase Hatası: " + message, 'error');
        else logToTerminal("Firebase: " + message, 'success');
    }

    const db = firebase.firestore();
    const stateRef = db.collection('ambulance').doc('state');

    // Firebase Bağlantı Durumu Takibi
    firebase.database().ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            updateFirebaseUI('online', 'Bağlı');
        } else {
            updateFirebaseUI('offline', 'Kesildi');
        }
    });

    // Başlangıç dökümanı kontrolü
    stateRef.get().then(doc => {
        if (!doc.exists) {
            stateRef.set({ lamps: {}, sensors: {}, arduinoConnected: false }, { merge: true })
                .catch(err => logToTerminal("Firebase Yazma Hatası: " + err.message, 'error'));
        }
    }).catch(err => {
        updateFirebaseUI('offline', 'Erişim Yok');
        logToTerminal("Firestore Erişilemiyor: " + err.message, 'error');
    });

    // --- BUTON KONTROLLERİ ---
    const allButtons = document.querySelectorAll('[data-lamp]');
    
    allButtons.forEach(button => {
        button.addEventListener('click', () => {
            const lampId = button.getAttribute('data-lamp');
            const isActive = !button.classList.contains('active');
            
            // Yerel UI Güncelleme
            updateButtonUI(lampId, isActive);

            // Firebase Güncelleme
            let updateObj = { lamps: {} };
            updateObj.lamps[lampId] = isActive;
            
            stateRef.set(updateObj, { merge: true })
                .then(() => logToTerminal(`Buton ${lampId} -> ${isActive ? 'AÇIK' : 'KAPALI'} (Buluta Gönderildi)`))
                .catch(err => logToTerminal("Bulut Güncelleme Hatası: " + err.message, 'error'));
            
            // Titreşim
            if (navigator.vibrate) navigator.vibrate(isActive ? [30, 30] : 20);
        });
    });

    function updateButtonUI(lampId, isActive) {
        const relatedButtons = document.querySelectorAll(`[data-lamp="${lampId}"]`);
        relatedButtons.forEach(btn => {
            if (isActive) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    // --- FIREBASE DİNLEME (SnapShot) ---
    stateRef.onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        
        // 1. Lambaları Senkronize Et
        if (data.lamps) {
            Object.keys(data.lamps).forEach(lampId => {
                const isActive = data.lamps[lampId];
                
                // Sadece durum değişmişse ve biz yerel olarak zaten yapmamışsak
                if (lastLampsState[lampId] !== isActive) {
                    updateButtonUI(lampId, isActive);
                    
                    // Eğer Arduino bağlıysa komutu gönder
                    if (window.arduinoWriter) {
                        const cmd = `${lampId}_${isActive ? 'ON' : 'OFF'}\n`;
                        window.arduinoWriter.write(new TextEncoder().encode(cmd)).catch(e => logToTerminal("Arduino Yazma Hatası", 'error'));
                    }
                }
                lastLampsState[lampId] = isActive;
            });
        }

        // 2. Arduino Bağlantı Durumu (Eğer biz bağlı değilsek başkasından gelen bilgiyi göster)
        if (!window.arduinoWriter) {
            updateSerialUI(data.arduinoConnected || false);
        }

        // 3. Sensörleri Güncelle (Eğer seri bağlı değilse Firebase'den al)
        if (!window.arduinoWriter && data.sensors) {
            updateSensorsUI(data.sensors);
        }
    }, err => {
        logToTerminal("Firebase Dinleme Hatası: " + err.message, 'error');
    });

    function updateSensorsUI(sensors) {
        if(sensors.battery && batteryVolt) batteryVolt.innerText = sensors.battery;
        if(sensors.solar && solarVolt) solarVolt.innerText = sensors.solar;
        if(sensors.temp && temperature) temperature.innerText = sensors.temp;
        
        if(sensors.cleanW !== undefined) {
            const cW = parseFloat(sensors.cleanW);
            if(cleanWaterBar) cleanWaterBar.innerText = cW.toFixed(1);
            if(cleanWaterLevel) cleanWaterLevel.style.height = `${Math.min(100, (cW / 5) * 100)}%`;
        }
        if(sensors.dirtyW !== undefined) {
            const dW = parseFloat(sensors.dirtyW);
            if(dirtyWaterBar) dirtyWaterBar.innerText = dW.toFixed(1);
            if(dirtyWaterLevel) dirtyWaterLevel.style.height = `${Math.min(100, (dW / 5) * 100)}%`;
        }
    }

    function updateSerialUI(isConnected) {
        const dot = connectSerialBtn.querySelector('.pulse-dot');
        if (isConnected) {
            dot.className = 'pulse-dot connected';
            serialStatusText.innerText = 'Bağlı';
            connectSerialBtn.style.color = '#2ed573';
            connectSerialBtn.style.borderColor = '#2ed573';
        } else {
            dot.className = 'pulse-dot disconnected';
            serialStatusText.innerText = 'Bağlan';
            connectSerialBtn.style.color = 'white';
            connectSerialBtn.style.borderColor = 'rgba(255,255,255,0.2)';
        }
    }

    // --- ARDUINO WEB SERIAL ---
    if (connectSerialBtn) {
        connectSerialBtn.addEventListener('click', async () => {
            if (!("serial" in navigator)) {
                alert("Tarayıcınız Web Serial API desteklemiyor. Lütfen Chrome veya Edge kullanın.");
                return;
            }

            try {
                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });
                
                window.arduinoWriter = port.writable.getWriter();
                updateSerialUI(true);
                logToTerminal("Arduino Bağlantısı Başarılı", 'success');
                
                // Başlangıç durumunu gönder
                Object.keys(lastLampsState).forEach(id => {
                    const cmd = `${id}_${lastLampsState[id] ? 'ON' : 'OFF'}\n`;
                    window.arduinoWriter.write(new TextEncoder().encode(cmd)).catch(()=>{});
                });

                stateRef.set({ arduinoConnected: true }, { merge: true });
                readLoop(port);
            } catch (err) {
                logToTerminal("Bağlantı Hatası: " + err.message, 'error');
            }
        });
    }

    async function readLoop(port) {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();
        let buffer = "";

        try {
            while (keepReading) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += value;
                const lines = buffer.split('\n');
                buffer = lines.pop(); 
                
                lines.forEach(line => {
                    line = line.trim();
                    if(!line) return;
                    
                    logToTerminal("RX: " + line); // Terminale yaz

                    if (line.startsWith("DATA:")) {
                        const parts = line.replace("DATA:", "").split(",");
                        if (parts.length === 5) {
                            const sensorData = {
                                battery: parts[0],
                                solar: parts[1],
                                temp: parts[2],
                                cleanW: parseFloat(parts[3]),
                                dirtyW: parseFloat(parts[4])
                            };
                            
                            updateSensorsUI(sensorData);
                            
                            // Buluta yolla
                            stateRef.set({ sensors: sensorData }, { merge: true })
                                .catch(e => logToTerminal("Sensör Bulut Hatası", 'error'));
                        }
                    }
                });
            }
        } catch (error) {
            logToTerminal("Okuma Döngüsü Kırıldı: " + error.message, 'error');
            updateSerialUI(false);
            stateRef.set({ arduinoConnected: false }, { merge: true });
        }
    }

    window.addEventListener('beforeunload', () => {
        if (window.arduinoWriter) {
            stateRef.set({ arduinoConnected: false }, { merge: true });
        }
    });
});
