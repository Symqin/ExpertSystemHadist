/**
 * Knowledge Base untuk Hadits Palsu (Maudhu) atau Dhaif Jiddan (Sangat Lemah).
 * Menyediakan aturan berbasis kata kunci untuk Forward Chaining Sistem Pakar.
 */
const MAUDHU_RULES = [
    {
        id: "RULE_KEBERSIHAN",
        keywords: [
            "kebersihan", 
            "sebagian dari iman", 
            "annadhafatu"
        ],
        requiredMatches: 2, // Minimal 2 keywords harus ada untuk diputuskan
        status: "SANGAT LEMAH / BUKAN HADITS",
        reasoning: "Ungkapan 'Kebersihan adalah sebagian dari iman' (Annadhafatu minal iman) populer di masyarakat, namun secara sanad hadits dengan lafaz ini dinilai SANGAT LEMAH (Dhaif Jiddan) atau bahkan palsu menurut para ahli hadits seperti Syaikh Al-Albani. \n\nYang berstatus SHAHIH adalah lafaz: 'Ath-thuhuru syathrul iman' (Bersuci adalah sebagian dari iman) riwayat riwayat Muslim no. 223."
    },
    {
        id: "RULE_TUNTUT_CINA",
        keywords: [
            "tuntutlah ilmu", 
            "sampai ke", 
            "cina", 
            "negeri cina",
            "walaubisshin"
        ],
        requiredMatches: 2,
        status: "PALSU (MAUDHU')",
        reasoning: "Hadits 'Tuntutlah ilmu walau sampai ke negeri Cina' diriwayatkan oleh Ibnu Adi dan Al-Baihaqi. Namun Syaikh Al-Albani menilainya sebagai hadits PALSU (Maudhu) karena di dalam sanadnya terdapat perawi pendusta bernama Abu Atikah Tharif bin Sulaiman. Syaikhul Islam Ibnu Taimiyah juga mengatakan ini bukan sabda Nabi ﷺ."
    },
    {
        id: "RULE_SURGA_IBU",
        keywords: [
            "surga", 
            "berada di", 
            "bawah telapak kaki", 
            "ibu",
            "kaki ibu"
        ],
        requiredMatches: 3,
        status: "PALSU (MAUDHU')",
        reasoning: "Lafaz 'Surga itu di bawah telapak kaki ibu' (al jannatu tahta aqdamil ummahat) diriwayatkan oleh Ibnu Ady. Ibnu Tahir mengatakan sanadnya PALSU karena ada perawi Manshur bin Al-Muhajir dan Abu An-Nadhar yang tidak dikenal (majhul). \n\nSebagai gantinya, ada hadits sahih yang semakna dari riwayat An-Nasa'i (no. 3104): '...celakalah engkau, tetaplah bersamanya (ibumu), karena sesungguhnya surga berada di bawah kedua kakinya'."
    },
    {
        id: "RULE_HUBBUL_WATHON",
        keywords: [
            "cinta", 
            "tanah air", 
            "sebagian dari", 
            "iman",
            "hubbul wathon"
        ],
        requiredMatches: 3,
        status: "PALSU (MAUDHU')",
        reasoning: "Ungkapan 'Hubbul Wathon Minal Iman' (Cinta tanah air sebagian dari iman) adalah perkataan yang sangat disepakati kepalsuannya oleh para ahli hadits ahli tahqiq. As-Sakhawi, Al-Albani, dan As-Suyuthi menegaskan bahwa ini BUKAN hadits Nabi ﷺ, melainkan sekadar ungkapan pepatah Arab yang maknanya benar namun haram disandarkan pada Nabi (didustakan)."
    },
    {
        id: "RULE_IKHTILAF_RAHMAH",
        keywords: [
            "perbedaan", 
            "umatku", 
            "adalah", 
            "rahmat",
            "ikhtilaf",
            "ikhtilafu"
        ],
        requiredMatches: 3,
        status: "PALSU (TIDAK ADA ASAL-USULNYA)",
        reasoning: "Hadits 'Perbedaan (ikhtilaf) di tengah umatku adalah rahmat' ditegaskan oleh As-Subki dan Al-Albani sebagai hadits yang TIDAK ADA SANADNYA (La Ashla Lahu). Lafaz ini sama sekali tidak ditemukan dalam kitab-kitab hadits yang bersanad (bahkan yang palsu sekalipun)."
    },
    {
        id: "RULE_TIDUR_PUASA",
        keywords: [
            "tidurnya",
            "orang berpuasa",
            "adalah",
            "ibadah",
            "naumu",
            "shaimi"
        ],
        requiredMatches: 3,
        status: "LEMAH (DHAIF) / PALSU",
        reasoning: "Hadits 'Tidurnya orang yang berpuasa adalah ibadah, diamnya adalah tasbih' diriwayatkan oleh Al-Baihaqi. Syaikh Al-Albani menghukuminya Lemah/Palsu (Dhaif) karena di dalam sanadnya terdapat perawi bernama Sulaiman bin Amr An-Nakha'i yang disepakati oleh para ulama sebagai pemalsu hadits (Kadzdzab)."
    }
];

module.exports = {
    MAUDHU_RULES
};
