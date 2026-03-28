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
            
            // Burada ESP32'ye veya Firebase'e sinyal gönderilir.
            // Örnek: ws.send(JSON.stringify({ type: 'device', id: lampId, state: willBeActive }));
            
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

    // ESP32'den verilerin periyodik olarak okunduğunu simüle eden fonksiyon
    function updateWaterTanksLocalSimulation() {
        // Normalde bu veriler ESP32'den WebSocket veya HTTP Polling/Firebase Realtime Database ile gelir.
        
        // Simüle edilen bar değerleri (örneğin titreşimli okumalar)
        // Sabit tutalım ki arayüzde çok oynamasın, hafif gitsin gelsin.
        
        let currentClean = parseFloat(cleanWaterBar.innerText);
        let currentDirty = parseFloat(dirtyWaterBar.innerText);
        
        // Rastgele çok küçük değişimler (Sensör gürültüsü)
        currentClean += (Math.random() - 0.5) * 0.05;
        currentDirty += (Math.random() - 0.5) * 0.05;
        
        // Sınırlandırma
        if(currentClean < 0) currentClean = 0;
        if(currentClean > 5) currentClean = 5; // Max 5 bar diyelim
        
        if(currentDirty < 0) currentDirty = 0;
        if(currentDirty > 5) currentDirty = 5;

        // Ekrana yazdırma (1 ondalık hane)
        cleanWaterBar.innerText = currentClean.toFixed(1);
        dirtyWaterBar.innerText = currentDirty.toFixed(1);
        
        // Tank yükseklik yüzdesi hesaplama (5 bar = %100)
        let cleanPercentage = (currentClean / 5) * 100;
        let dirtyPercentage = (currentDirty / 5) * 100;
        
        cleanWaterLevel.style.height = `${cleanPercentage}%`;
        dirtyWaterLevel.style.height = `${dirtyPercentage}%`;
    }

    // Telemetri (Voltaj ve Sıcaklık) Simülasyonu
    const batteryVolt = document.getElementById('batteryVolt');
    const solarVolt = document.getElementById('solarVolt');
    const temperature = document.getElementById('temperature');

    function updateTelemetry() {
        let bVolt = parseFloat(batteryVolt.innerText);
        let sVolt = parseFloat(solarVolt.innerText);
        let temp = parseFloat(temperature.innerText);

        bVolt += (Math.random() - 0.5) * 0.1;
        sVolt += (Math.random() - 0.5) * 0.2;
        temp += (Math.random() - 0.5) * 0.1;

        if(bVolt < 11.5) bVolt = 11.5; if(bVolt > 14.4) bVolt = 14.4;
        if(sVolt < 0) sVolt = 0; if(sVolt > 18.0) sVolt = 18.0;
        if(temp < 15) temp = 15; if(temp > 35) temp = 35;

        batteryVolt.innerText = bVolt.toFixed(1);
        solarVolt.innerText = sVolt.toFixed(1);
        temperature.innerText = temp.toFixed(1);
    }

    // Her 2 saniyede bir sensörleri simüle et
    setInterval(() => {
        updateWaterTanksLocalSimulation();
        updateTelemetry();
    }, 2000);
});
