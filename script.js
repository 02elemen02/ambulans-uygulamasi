document.addEventListener('DOMContentLoaded', () => {
    // Tarih ve Saat Güncellemesi
    const datetimeDisplay = document.getElementById('datetimeDisplay');
    function updateDateTime() {
        if (!datetimeDisplay) return;
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        datetimeDisplay.innerText = now.toLocaleDateString('tr-TR', options);
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Firebase Ayarları
    const db = firebase.firestore();
    const stateRef = db.collection('ambulance').doc('state');
    
    // Uygulama açılışında doküman yoksa boş oluştur
    stateRef.get().then(doc => {
        if (!doc.exists) {
            stateRef.set({ lamps: {}, sensors: {} });
        }
    });

    // Lamba ve Donanım Butonları Mantığı
    const allButtons = document.querySelectorAll('[data-lamp]');
    
    allButtons.forEach(button => {
        button.addEventListener('click', () => {
            const lampId = button.getAttribute('data-lamp');
            // Tıklanan butonun şu anki durumunun tersini alıyoruz
            const willBeActive = !button.classList.contains('active');
            
            // DİKKAT: Artık doğrudan Serial'a yazmıyor veya UI'ı değiştirmiyoruz. 
            // Sadece Firebase'e "olması gereken durumu" yazıyoruz. 
            // Firebase tetiklendiğinde UI değişecek ve Arduino'ya komut gidecek.
            stateRef.set({
                lamps: {
                    [lampId]: willBeActive
                }
            }, { merge: true });
            
            // Haptic feedback (telefon titremesi)
            if (navigator.vibrate) {
                navigator.vibrate(willBeActive ? [50, 50, 50] : 50);
            }
        });
    });

    let lastLampsState = {};

    // Firebase'den Gerçek Zamanlı Dinleme (onSnapshot)
    stateRef.onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            
            // Lambaları Senkronize Et
            if (data.lamps) {
                Object.keys(data.lamps).forEach(lampId => {
                    const isActive = data.lamps[lampId];
                    const relatedButtons = document.querySelectorAll(`[data-lamp="${lampId}"]`);
                    
                    relatedButtons.forEach(btn => {
                        if (isActive) btn.classList.add('active');
                        else btn.classList.remove('active');
                    });
                    
                    // Eğer bilgisayardaysak (Web Serial bağlıysa) ve durum Firebase'de yeniyse Arduino'ya gönder
                    if (window.arduinoWriter && lastLampsState[lampId] !== isActive) {
                        const command = `${lampId}_${isActive ? 'ON' : 'OFF'}\n`;
                        window.arduinoWriter.write(new TextEncoder().encode(command)).catch(err => {
                            console.error("Arduino'ya komut gönderilemedi:", err);
                        });
                    }
                    
                    lastLampsState[lampId] = isActive;
                });
            }

            // Arduino Bağlantı Durumunu Senkronize Et
            if (!window.arduinoWriter && data.arduinoConnected !== undefined) {
                const btn = document.getElementById('connectSerialBtn');
                if (btn) {
                    if (data.arduinoConnected) {
                        btn.innerHTML = `<span class="pulse-dot" style="background-color: #2ed573; box-shadow: 0 0 8px rgba(46, 213, 115, 0.6);"></span> Arduino Bağlandı`;
                        btn.style.color = "#2ed573";
                        btn.style.borderColor = "#2ed573";
                    } else {
                         btn.innerHTML = `<span class="pulse-dot" style="background-color: #ff4757; box-shadow: 0 0 8px rgba(255, 71, 87, 0.6);"></span> Arduino'ya Bağlan`;
                         btn.style.color = "white";
                         btn.style.borderColor = "rgba(255,255,255,0.2)";
                    }
                }
            }

            // Sensörleri Senkronize Et (Sadece telefondayken yani Web Serial BAĞLI DEĞİLKEN Firebase'den ekrana yazdırırız)
            // Bilgisayardaysak zaten veriyi Serial'den sıcağı sıcağına alıp ekrana yazıyoruz.
            if (!window.arduinoWriter && data.sensors) {
                if(data.sensors.battery) document.getElementById('batteryVolt').innerText = data.sensors.battery;
                if(data.sensors.solar) document.getElementById('solarVolt').innerText = data.sensors.solar;
                if(data.sensors.temp) document.getElementById('temperature').innerText = data.sensors.temp;
                
                if(data.sensors.cleanW !== undefined) {
                    const cW = parseFloat(data.sensors.cleanW);
                    const cleanWaterBar = document.getElementById('cleanWaterBar');
                    const cleanWaterLevel = document.getElementById('cleanWaterLevel');
                    if(cleanWaterBar) cleanWaterBar.innerText = cW.toFixed(1);
                    if(cleanWaterLevel) cleanWaterLevel.style.height = `${(cW / 5) * 100}%`;
                }
                if(data.sensors.dirtyW !== undefined) {
                    const dW = parseFloat(data.sensors.dirtyW);
                    const dirtyWaterBar = document.getElementById('dirtyWaterBar');
                    const dirtyWaterLevel = document.getElementById('dirtyWaterLevel');
                    if(dirtyWaterBar) dirtyWaterBar.innerText = dW.toFixed(1);
                    if(dirtyWaterLevel) dirtyWaterLevel.style.height = `${(dW / 5) * 100}%`;
                }
            }
        }
    });

    const batteryVolt = document.getElementById('batteryVolt');
    const solarVolt = document.getElementById('solarVolt');
    const temperature = document.getElementById('temperature');
    const cleanWaterLevel = document.getElementById('cleanWaterLevel');
    const cleanWaterBar = document.getElementById('cleanWaterBar');
    const dirtyWaterLevel = document.getElementById('dirtyWaterLevel');
    const dirtyWaterBar = document.getElementById('dirtyWaterBar');

    // Arduino Web Serial Bağlantısı
    window.arduinoWriter = null;
    let keepReading = true;
    let reader;

    const connectSerialBtn = document.getElementById('connectSerialBtn');
    
    if (connectSerialBtn) {
        connectSerialBtn.addEventListener('click', async () => {
            if (window.location.protocol === 'file:') {
                alert("DİKKAT: Web Serial bağlantısı güvenlik sebebiyle dosyaya çift tıklayarak ('file://') açıldığında ÇALIŞMAZ! Lütfen VS Code Live Server gibi bir özellik kullanın veya siteyi Github Pages linkinizden açın.");
            }
            if (!("serial" in navigator)) {
                alert("Tarayıcınız Web Serial API desteklemiyor. Lütfen bilgisayardan Google Chrome veya Edge kullanın.");
                return;
            }

            try {
                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });
                
                connectSerialBtn.innerHTML = `<span class="pulse-dot" style="background-color: #2ed573; box-shadow: 0 0 8px rgba(46, 213, 115, 0.6);"></span> Arduino Bağlandı`;
                connectSerialBtn.style.color = "#2ed573";
                connectSerialBtn.style.borderColor = "#2ed573";
                
                window.arduinoWriter = port.writable.getWriter();
                
                // Bağlantı durumunu Firebase'e yaz
                stateRef.set({ arduinoConnected: true }, { merge: true });
                
                // Başlangıçta mevcut durumu Arduino'ya senkronize et (Firebase'deki son hali)
                Object.keys(lastLampsState).forEach(lampId => {
                     const initCmd = `${lampId}_${lastLampsState[lampId] ? 'ON' : 'OFF'}\n`;
                     window.arduinoWriter.write(new TextEncoder().encode(initCmd)).catch(e=>{});
                });

                readLoop(port);
            } catch (err) {
                console.error("Arduino bağlantı hatası:", err);
                alert("Bağlantı kurulamadı. Arduino'nun takılı olduğundan ve başka bir uygulamanın portu işgal etmediğinden emin olun.");
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
                if (done) {
                    reader.releaseLock();
                    break;
                }
                buffer += value;
                const lines = buffer.split('\n');
                buffer = lines.pop(); 
                
                lines.forEach(line => {
                    line = line.trim();
                    if (line.startsWith("DATA:")) {
                        const parts = line.replace("DATA:", "").split(",");
                        if (parts.length === 5) {
                            const bV = parts[0];
                            const sV = parts[1];
                            const tV = parts[2];
                            const cV = parseFloat(parts[3]);
                            const dV = parseFloat(parts[4]);

                            if(batteryVolt) batteryVolt.innerText = bV;
                            if(solarVolt) solarVolt.innerText = sV;
                            if(temperature) temperature.innerText = tV;
                            
                            if(cleanWaterBar) cleanWaterBar.innerText = cV.toFixed(1);
                            if(dirtyWaterBar) dirtyWaterBar.innerText = dV.toFixed(1);
                            
                            if(cleanWaterLevel) cleanWaterLevel.style.height = `${(cV / 5) * 100}%`;
                            if(dirtyWaterLevel) dirtyWaterLevel.style.height = `${(dV / 5) * 100}%`;

                            // Sensör verisini telefondan da görülebilmesi için Firebase'e itiyoruz
                            stateRef.set({
                                sensors: {
                                    battery: bV,
                                    solar: sV,
                                    temp: tV,
                                    cleanW: cV,
                                    dirtyW: dV
                                }
                            }, { merge: true });
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Okuma hatası:", error);
        }
    }

    // Bilgisayardan sekme kapatıldığında veya çıkıldığında bağlantıyı koptu olarak işaretle
    window.addEventListener('beforeunload', () => {
        if (window.arduinoWriter) {
            // Unload sırasında asenkron istekler iptal olabileceği için navigator.sendBeacon da kullanılabilir ancak set çalışır.
            stateRef.set({ arduinoConnected: false }, { merge: true });
        }
    });

});
