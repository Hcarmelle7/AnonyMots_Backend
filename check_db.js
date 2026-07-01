const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Base de données SQLite locale dans le même dossier
const dbPath = path.resolve(__dirname, './anonymots.db');

console.log('--- INSPECTION DE LA BASE DE DONNÉES SQLite ---');
console.log('Chemin:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Erreur d\'ouverture:', err.message);
    process.exit(1);
  }
  
  // Requête pour lister les utilisateurs créés
  db.all('SELECT * FROM users ORDER BY created_at DESC LIMIT 5', [], (err, users) => {
    if (err) {
      console.error('Erreur lecture table users:', err.message);
    } else {
      console.log('\n--- 👥 DERNIERS UTILISATEURS ENREGISTRÉS ---');
      console.table(users);
    }
    
    // Requête pour lister les messages anonymes échangés
    db.all('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5', [], (err, messages) => {
      if (err) {
        console.error('Erreur lecture table messages:', err.message);
      } else {
        console.log('\n--- ✉️ DERNIERS MESSAGES ENREGISTRÉS ---');
        console.table(messages);
      }
      
      // Requête pour compter les citations bienveillantes
      db.get('SELECT COUNT(*) as count FROM wellness_messages', [], (err, row) => {
        if (err) {
          console.error('Erreur lecture table wellness_messages:', err.message);
        } else {
          console.log(`\n--- 🌸 TOTAL DE CITATIONS BIENVEILLANTES EN BASE : ${row.count} ---`);
        }
        
        // Requête pour compter les résultats du quiz
        db.get('SELECT COUNT(*) as count FROM quiz_results', [], (err, quizRow) => {
          if (err) {
            console.error('Erreur lecture table quiz_results:', err.message);
          } else {
            console.log(`--- 🔮 TOTAL DE RÉSULTATS DU QUIZ EN BASE : ${quizRow.count} ---`);
          }
          
          // Fermeture propre de la base de données
          db.close((err) => {
            if (err) console.error(err.message);
            console.log('\n--- FIN DE L\'INSPECTION ---');
          });
        });
      });
    });
  });
});
