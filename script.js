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

    // Lamba ve Donanım Butonları Mantığı
    const allButtons = document.querySelectorAll('[data-lamp]');
    
    allButtons.forEach(button => {
        button.addEventListener('click', () => {
            const lampId = button.getAttribute('data-lamp');
            
            // Aynı data-lamp ID'sine sahip tüm butonları bul (hem görsel üstü hem grid)
            const relatedButtons = document.querySelectorAll(`[data-lamp="${lampId}"]`);
            
            // Tıklanan butonun şu anki durumunun tersini alıyoruz
            const willBeActive = !button.classList.contains('active');
            
            relatedButtons.forEach(btn => {
                if (willBeActive) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            console.log(`Donanım ${lampId} durumu: ${willBeActive ? 'AÇIK' : 'KAPALI'}`);
            
            // Arduino'ya Serial üzerinden sinyal gönder
            if (window.arduinoWriter) {
                const command = `${lampId}_${willBeActive ? 'ON' : 'OFF'}\n`;
                window.arduinoWriter.write(new TextEncoder().encode(command)).catch(err => {
                    console.error("Arduino'ya komut gönderilemedi:", err);
                });
            }
            
            // Haptic feedback (telefon titremesi)
            if (navigator.vibrate) {
                navigator.vibrate(willBeActive ? [50, 50, 50] : 50);
            }
        });
    });

    // Simüle Edilmiş Su Tankı Verileri (Sensörden geliyormuş gibi)
    const cleanWaterLevel = document.getElementById('cleanWaterLevel');
    const cleanWaterBar = document.getElementById('cleanWaterBar');
    
    const dirtyWaterLevel = document.getElementById('dirtyWaterLevel');
    const dirtyWaterBar = document.getElementById('dirtyWaterBar');

    const batteryVolt = document.getElementById('batteryVolt');
    const solarVolt = document.getElementById('solarVolt');
    const temperature = document.getElementById('temperature');

    // Arduino Web Serial Bağlantısı
    window.arduinoWriter = null;
    let keepReading = true;
    let reader;

    const connectSerialBtn = document.getElementById('connectSerialBtn');
    
    if (connectSerialBtn) {
        connectSerialBtn.addEventListener('click', async () => {
            if (!("serial" in navigator)) {
                alert("Tarayıcınız Web Serial API desteklemiyor. Lütfen bilgisayardan Google Chrome veya Edge kullanın.");
                return;
            }

            try {
                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });
                
                // Butonu bağlandı durumuna getir
                connectSerialBtn.innerHTML = `<span class="pulse-dot" style="background-color: #2ed573; box-shadow: 0 0 8px rgba(46, 213, 115, 0.6);"></span> Arduino Bağlandı`;
                connectSerialBtn.style.color = "#2ed573";
                connectSerialBtn.style.borderColor = "#2ed573";
                
                window.arduinoWriter = port.writable.getWriter();
                
                // Veri okuma döngüsünü başlat
                readLoop(port);
            } catch (err) {
                console.error("Arduino bağlantı hatası:", err);
                alert("Bağlantı kurulamadı. Arduino'nun USB ile takılı olduğundan ve başka bir programın (Arduino IDE) portu işgal etmediğinden emin olun.");
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
                buffer = lines.pop(); // Son bitmemiş satırı buffer'da tut
                
                lines.forEach(line => {
                    line = line.trim();
                    if (line.startsWith("DATA:")) {
                        // Örn: DATA:12.5,14.1,24.5,3.2,1.1
                        const parts = line.replace("DATA:", "").split(",");
                        if (parts.length === 5) {
                            if(batteryVolt) batteryVolt.innerText = parts[0];
                            if(solarVolt) solarVolt.innerText = parts[1];
                            if(temperature) temperature.innerText = parts[2];
                            
                            const cleanVal = parseFloat(parts[3]);
                            const dirtyVal = parseFloat(parts[4]);
                            
                            if(cleanWaterBar) cleanWaterBar.innerText = cleanVal.toFixed(1);
                            if(dirtyWaterBar) dirtyWaterBar.innerText = dirtyVal.toFixed(1);
                            
                            if(cleanWaterLevel) cleanWaterLevel.style.height = `${(cleanVal / 5) * 100}%`;
                            if(dirtyWaterLevel) dirtyWaterLevel.style.height = `${(dirtyVal / 5) * 100}%`;
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Okuma hatası:", error);
        }
    }
});
