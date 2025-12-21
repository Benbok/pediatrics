export interface LectureContent {
  title: string;
  content: string; // HTML string
}

export const LECTURES: Record<string, LectureContent> = {
  'hepb': {
    title: 'Вакцина против Гепатита B: Клиническое руководство',
    content: `
      <div class="space-y-6">
        <section>
          <h3>1. Введение и Эпидемиология</h3>
          <p><strong>Вирусный гепатит B</strong> — одна из самых частых инфекций в мире. В России заболеваемость среди детей снизилась благодаря вакцинации, но риск остается высоким из-за хронического носительства.</p>
          <ul class="list-disc pl-5 space-y-1">
            <li><strong>Глобально:</strong> 257 млн человек инфицированы хронически.</li>
            <li><strong>Перинатальная передача:</strong> 90% новорожденных, инфицированных от матери, становятся хроническими носителями. Это ведет к циррозу и раку печени в будущем.</li>
          </ul>
          <p class="mt-2 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded border-l-4 border-blue-500">
            <strong>Цель вакцинации:</strong> Профилактика не только острого гепатита, но и его грозных осложнений (цирроз, гепатоцеллюлярная карцинома).
          </p>
        </section>

        <section>
          <h3>2. Схема применения (РФ)</h3>
          <table class="w-full text-sm text-left border-collapse my-4">
            <thead>
              <tr class="bg-slate-100 dark:bg-slate-800">
                <th class="p-2 border border-slate-200 dark:border-slate-700">Возраст</th>
                <th class="p-2 border border-slate-200 dark:border-slate-700">Этап</th>
                <th class="p-2 border border-slate-200 dark:border-slate-700">Примечание</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="p-2 border border-slate-200 dark:border-slate-700">24 часа жизни</td>
                <td class="p-2 border border-slate-200 dark:border-slate-700">V1 (Первая)</td>
                <td class="p-2 border border-slate-200 dark:border-slate-700">В роддоме. При HBsAg+ матери + иммуноглобулин.</td>
              </tr>
              <tr>
                <td class="p-2 border border-slate-200 dark:border-slate-700">1 месяц</td>
                <td class="p-2 border border-slate-200 dark:border-slate-700">V2 (Вторая)</td>
                <td class="p-2 border border-slate-200 dark:border-slate-700">Стандартная схема.</td>
              </tr>
              <tr>
                <td class="p-2 border border-slate-200 dark:border-slate-700">6 месяцев</td>
                <td class="p-2 border border-slate-200 dark:border-slate-700">V3 (Третья)</td>
                <td class="p-2 border border-slate-200 dark:border-slate-700">Завершение курса. Защита ≥30 лет.</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Для групп риска</strong> (мать носитель вируса) применяется схема: 0-1-2-12 месяцев (4 дозы).</p>
        </section>

        <section>
          <h3>3. Догоняющая вакцинация (Catch-up)</h3>
          <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500">
             <h4 class="font-bold text-amber-800 dark:text-amber-300 mb-2">Если график нарушен</h4>
             <p class="mb-2">Главное правило: <strong>Серию прививок никогда не начинают заново</strong>, независимо от того, сколько времени прошло с последней дозы. Все сделанные ранее прививки засчитываются.</p>
             <ul class="list-disc pl-5 space-y-1 text-sm">
                <li>Если вакцинация <strong>не была проведена в роддоме</strong>: детей прививают по стандартной схеме 0–1–6.</li>
                <li>Если серия <strong>прервана</strong> (сделана 1 или 2 прививки и прошел год/два): просто вводят недостающие дозы до завершения курса (всего должно быть 3 дозы).</li>
             </ul>
          </div>
        </section>

        <section>
          <h3>4. Безопасность и Реакции</h3>
          <p>Вакцина является <strong>рекомбинантной</strong> (генно-инженерной). Она содержит только HBsAg (белок оболочки), полученный в дрожжах. В ней <strong>нет самого вируса</strong>, заболеть от прививки невозможно.</p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg">
              <h4 class="text-emerald-800 dark:text-emerald-300 font-bold mb-2">Нормальные реакции</h4>
              <ul class="list-disc pl-4 text-sm space-y-1">
                <li>Боль в месте укола (25%)</li>
                <li>Небольшой отек или краснота</li>
                <li>Субфебрильная температура (редко, 3-5%)</li>
                <li>Проходят самостоятельно за 1-2 дня.</li>
              </ul>
            </div>
            <div class="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
              <h4 class="text-slate-800 dark:text-slate-300 font-bold mb-2">Мифы</h4>
               <p class="text-sm">"Вакцина вызывает желтушку?" — <strong>Нет</strong>. Желтуха новорожденных — физиологический процесс, не связанный с вакцинацией от Гепатита B.</p>
            </div>
          </div>
        </section>
      </div>
    `
  },
  'bcg': {
    title: 'Вакцина БЦЖ (Туберкулез): Руководство',
    content: `
      <div class="space-y-6">
        <section>
          <h3>1. Зачем нужна прививка БЦЖ?</h3>
          <p>Туберкулез (ТБ) остается одной из главных инфекционных угроз. У детей раннего возраста ТБ часто принимает молниеносные, смертельные формы (туберкулезный менингит, диссеминированный ТБ).</p>
          <p class="mt-2 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded border-l-4 border-blue-500">
             <strong>Главная цель БЦЖ:</strong> Не столько защитить от инфицирования вообще, сколько предотвратить смертельные формы туберкулеза у детей (эффективность против менингита 90-95%).
          </p>
        </section>
        
        <section>
          <h3>2. Догоняющая вакцинация (Catch-up)</h3>
          <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500">
             <h4 class="font-bold text-amber-800 dark:text-amber-300 mb-2">Если не сделали в роддоме</h4>
             <ul class="list-disc pl-5 space-y-2 text-sm">
                <li><strong>Ребенку < 2 месяцев:</strong> Вакцинацию проводят без предварительных тестов (БЦЖ-М).</li>
                <li><strong>Ребенку > 2 месяцев:</strong> Сначала обязательно делают пробу <strong>Манту</strong>. Прививку делают только при <strong>отрицательном</strong> результате пробы (в день проверки или в течение 2 недель).</li>
             </ul>
          </div>
        </section>

        <section>
          <h3>3. Нормальная реакция на БЦЖ</h3>
          <p>БЦЖ вводится <strong>внутрикожно</strong>. После введения процесс заживления длится несколько месяцев. Это НОРМА.</p>
          <div class="relative pl-8 border-l border-slate-300 dark:border-slate-700 space-y-6 my-6">
             <div class="relative">
                <span class="absolute -left-[39px] bg-slate-200 dark:bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <strong>Папула (сразу):</strong> Белое уплотнение 3-7 мм.
             </div>
             <div class="relative">
                <span class="absolute -left-[39px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <strong>Пузырек/Гнойничок (4-6 недель):</strong> Появление пузырька, возможно с корочкой. <span class="text-rose-600 dark:text-rose-400 font-bold">Не давить, не мазать зеленкой!</span>
             </div>
             <div class="relative">
                <span class="absolute -left-[39px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <strong>Рубец (2-4 месяца):</strong> Формирование рубчика.
             </div>
          </div>
        </section>

        <section>
          <h3>4. Ревакцинация</h3>
          <p>Проводится в <strong>6-7 лет</strong>. Но только при условии, что реакция Манту <strong>отрицательная</strong>.</p>
        </section>
      </div>
    `
  },
  'dtp': {
    title: 'Вакцина АКДС (Дифтерия, Коклюш, Столбняк)',
    content: `
      <div class="space-y-6">
        <section>
          <h3>1. Что мы предотвращаем?</h3>
          <ul class="list-disc pl-5 space-y-2">
            <li><strong>Коклюш:</strong> Смертельно опасен для младенцев (апноэ).</li>
            <li><strong>Дифтерия:</strong> Токсин образует пленки в горле, может вызвать удушье.</li>
            <li><strong>Столбняк:</strong> Поражение нервной системы. Смертность до 20%.</li>
          </ul>
        </section>

        <section>
          <h3>2. Догоняющая вакцинация (Catch-up)</h3>
          <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500">
             <p class="mb-2 font-medium">При нарушении графика серию не начинают заново, а продолжают.</p>
             <ul class="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Детям до 4-6 лет:</strong> Можно использовать стандартные вакцины (АКДС, Пентаксим, Инфанрикс).</li>
                <li><strong>Детям старше 4-6 лет:</strong> Стандартная доза коклюшного компонента может вызвать сильную реакцию. Используются вакцины с <strong>уменьшенным содержанием антигенов</strong> (АДС-М - без коклюша, или Адасель - с уменьшенным коклюшем).</li>
             </ul>
          </div>
        </section>

        <section>
          <h3>3. Типы вакцин</h3>
          <div class="grid grid-cols-1 gap-4 mt-2">
            <div class="bg-slate-100 dark:bg-slate-800 p-3 rounded">
                <strong>Цельноклеточная (АКДС):</strong> Сильный иммунитет, но часто температура (40-50%).
            </div>
            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                <strong>Бесклеточная (Пентаксим, Инфанрикс):</strong> Переносится намного легче, температура редко.
            </div>
          </div>
        </section>
      </div>
    `
  },
  'polio': {
    title: 'Вакцина против Полиомиелита (ИПВ/ОПВ)',
    content: `
      <div class="space-y-6">
        <section>
           <h3>1. Виды вакцины</h3>
           <p>Полиомиелит почти ликвидирован в мире, но защита необходима.</p>
           <ul class="space-y-3 mt-2">
             <li class="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded">
                <strong>ИПВ (Инактивированная, укол):</strong> Содержит убитый вирус. Полностью безопасна.
             </li>
             <li class="bg-purple-50 dark:bg-purple-900/10 p-3 rounded">
                <strong>ОПВ (Живая, капли в рот):</strong> Содержит ослабленный вирус.
                <br/><span class="text-xs text-slate-500">Важно: После капель не кормить и не поить ребенка 30-60 минут.</span>
             </li>
           </ul>
        </section>

        <section>
           <h3>2. Схема в РФ</h3>
           <p>Обычно первые введения (2, 4, 6 мес) делают <strong>ИПВ</strong> (уколы). Живые капли (ОПВ) чаще используют для ревакцинации.</p>
        </section>
      </div>
    `
  },
  'hib': {
    title: 'Гемофильная инфекция (Hib)',
    content: `
      <div class="space-y-6">
        <section>
           <h3>1. От чего защищает?</h3>
           <p>Hib была главной причиной <strong>гнойного менингита</strong> и <strong>пневмонии</strong> у детей до 5 лет.</p>
        </section>

        <section>
          <h3>2. Догоняющая вакцинация (Catch-up)</h3>
          <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500">
             <h4 class="font-bold text-amber-800 dark:text-amber-300 mb-2">Правило: Чем старше ребенок, тем меньше доз</h4>
             <ul class="list-disc pl-5 space-y-1 text-sm">
                <li><strong>До 6 месяцев:</strong> Полный курс (3 дозы + ревакцинация).</li>
                <li><strong>6-12 месяцев:</strong> 2 дозы + ревакцинация.</li>
                <li><strong>После 15 месяцев (до 5 лет):</strong> Обычно достаточно <strong>одной дозы</strong>.</li>
                <li><strong>После 5 лет:</strong> Здоровым детям вакцинация обычно не требуется.</li>
             </ul>
          </div>
        </section>

        <section>
           <h3>3. Вакцина</h3>
           <p>Это конъюгированная вакцина. Часто входит в состав "Пентаксима" или "Инфанрикс Гекса". Переносится очень хорошо.</p>
        </section>
      </div>
    `
  },
  'pneumo': {
    title: 'Пневмококковая инфекция (Превенар)',
    content: `
      <div class="space-y-6">
        <section>
           <h3>1. Зачем прививаться?</h3>
           <p>Пневмококк вызывает пневмонии, отиты, менингиты и сепсис.</p>
        </section>

        <section>
          <h3>2. Догоняющая вакцинация (Catch-up)</h3>
          <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500">
             <h4 class="font-bold text-amber-800 dark:text-amber-300 mb-2">Правило: Чем старше ребенок, тем меньше доз</h4>
             <ul class="list-disc pl-5 space-y-1 text-sm">
                <li><strong>2-6 месяцев:</strong> 2 или 3 дозы (в зависимости от вакцины) + ревакцинация.</li>
                <li><strong>7-11 месяцев:</strong> 2 дозы + ревакцинация.</li>
                <li><strong>12-23 месяца:</strong> 2 дозы с интервалом 2 мес.</li>
                <li><strong>После 24 месяцев (2 лет):</strong> Здоровым детям обычно достаточно <strong>одной дозы</strong>.</li>
             </ul>
          </div>
        </section>

        <section>
           <h3>3. Вакцины (PCV)</h3>
           <p>Используются конъюгированные вакцины (Превенар 13, PCV15, PCV20). PCV20 — новый золотой стандарт.</p>
        </section>
      </div>
    `
  },
  'mmr': {
    title: 'Корь, Краснуха, Паротит (КПК)',
    content: `
      <div class="space-y-6">
         <section>
            <h3>1. Особенности вакцины</h3>
            <p>Это <strong>живая</strong> вакцина. Она вводится в 1 год и в 6 лет. </p>
            <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500 mt-2">
               <strong>Важная особенность:</strong> Реакция на эту прививку "отсроченная". Температура и небольшая сыпь могут появиться на <strong>5-12 день</strong>.
            </div>
         </section>

         <section>
            <h3>2. Догоняющая вакцинация</h3>
            <p>Если прививка не сделана в год, ее делают при первой возможности. Вторая доза вводится либо в 6 лет, либо раньше, но с минимальным интервалом <strong>4 недели</strong> после первой (в зависимости от эпидситуации).</p>
         </section>

         <section>
            <h3>3. Миф об аутизме</h3>
            <p>Связь вакцины MMR и аутизма была опровергнута многочисленными исследованиями (более 20 млн детей). Вакцина безопасна.</p>
         </section>
      </div>
    `
  },
  'meningo': {
    title: 'Менингококковая инфекция',
    content: `
      <div class="space-y-6">
         <section>
            <h3>1. Молниеносная опасность</h3>
            <p>Менингококк — причина бактериального менингита и сепсиса. Опасен тем, что может убить здорового ребенка за 24 часа (молниеносная форма). Характерный симптом — звездчатая сыпь, не исчезающая при нажатии.</p>
         </section>

         <section>
            <h3>2. Вакцинация</h3>
            <p>В РФ не всегда входит в базовый календарь ОМС (зависит от региона), но <strong>настоятельно рекомендуется</strong> педиатрами.</p>
            <p>Вакцины (например, Менактра) защищают от 4 групп (A, C, W, Y). Существуют также вакцины от группы B (Бексеро), но они менее доступны.</p>
         </section>
      </div>
    `
  },
  'hpv': {
    title: 'Вирус папилломы человека (ВПЧ)',
    content: `
      <div class="space-y-6">
         <section>
            <h3>1. Прививка от рака</h3>
            <p>Это уникальная вакцина, которая предотвращает <strong>рак</strong>. ВПЧ вызывает рак шейки матки, а также рак горла и других органов у мужчин и женщин.</p>
         </section>

         <section>
            <h3>2. Кому и когда?</h3>
            <p>Эффективнее всего вводить <strong>до начала половой жизни</strong>. </p>
            <ul class="list-disc pl-5">
               <li><strong>Девочки:</strong> 9-14 лет (оптимально).</li>
               <li><strong>Мальчики:</strong> Также рекомендуется (гендерно-нейтральный подход).</li>
            </ul>
         </section>
      </div>
    `
  },
  'rota': {
    title: 'Ротавирусная инфекция',
    content: `
      <div class="space-y-6">
         <section>
            <h3>1. Основная причина диареи</h3>
            <p>Ротавирус вызывает тяжелый гастроэнтерит с обезвоживанием, что является частой причиной госпитализации младенцев.</p>
         </section>
         
         <section>
            <h3>2. Исключение из правил (Строгие сроки!)</h3>
            <div class="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border-l-4 border-rose-500">
               <h4 class="font-bold text-rose-800 dark:text-rose-300 mb-2">Нельзя делать "вдогонку"</h4>
               <p class="mb-2">Это одна из немногих вакцин, которую <strong>нельзя делать</strong>, если упущены сроки, из-за риска инвагинации кишечника.</p>
               <ul class="list-disc pl-5 text-sm">
                  <li><strong>1-я доза:</strong> строго до 15 недель жизни.</li>
                  <li><strong>Последняя доза:</strong> строго до 8 месяцев.</li>
                  <li>Если вы не успели — вакцинация не проводится.</li>
               </ul>
            </div>
         </section>
      </div>
    `
  },
  'flu': {
    title: 'Грипп (Сезонная вакцинация)',
    content: `
      <div class="space-y-6">
         <section>
            <h3>1. Почему каждый год?</h3>
            <p>Вирус гриппа мутирует. Вакцина обновляется ежегодно под актуальные штаммы.</p>
         </section>
         <section>
            <h3>2. Дети - группа риска</h3>
            <p>Грипп опасен осложнениями (пневмония, отит) особенно для детей до 5 лет. Вакцинация разрешена с <strong>6 месяцев</strong>.</p>
         </section>
         <section>
            <h3>3. Схема</h3>
            <p>Детям до 9 лет, которые прививаются <strong>впервые</strong>, нужны <strong>2 дозы</strong> с интервалом в 1 месяц для формирования полноценной защиты.</p>
         </section>
      </div>
    `
  },
  'ats': {
    title: 'Экстренная профилактика столбняка (ПСС/ПСЧИ)',
    content: `
      <div class="space-y-6">
        <section>
          <h3>1. Нормативная база</h3>
          <p>Экстренная профилактика столбняка регулируется методическими указаниями <strong>МУ 3.1.2436-09</strong> (от 20.01.2009) "Эпидемиологический надзор за столбняком".</p>
        </section>

        <section>
          <h3>2. Показания к экстренной профилактике</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><strong>Травмы</strong> с нарушением целостности кожных покровов и слизистых оболочек.</li>
            <li><strong>Ожоги</strong> и обморожения второй, третьей и четвертой степеней.</li>
            <li><strong>Роды вне стационара</strong> и аборты вне лечебных учреждений.</li>
            <li><strong>Укусы</strong> животными.</li>
            <li>Проникающие повреждения желудочно-кишечного тракта.</li>
          </ul>
        </section>

        <section>
          <h3>3. Алгоритм действий</h3>
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
            <p>Экстренная профилактика должна проводиться как можно раньше, но не позднее <strong>20 дней</strong> с момента получения травмы.</p>
            <p class="mt-2">Она включает:</p>
            <ol class="list-decimal pl-5 mt-1 space-y-1 text-sm">
              <li>Первичную хирургическую обработку раны (ПХО).</li>
              <li>Специфическую иммунопрофилактику (введение препаратов).</li>
            </ol>
          </div>
        </section>

        <section>
          <h3>4. Новорожденные и Роды в домашних условиях</h3>
          <p>Если ребенок родился вне стационара от матери с неизвестным или неполным прививочным анамнезом:</p>
          <ul class="list-disc pl-5 mt-2 space-y-2">
            <li class="p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded">
                <strong>Приоритет:</strong> Противостолбнячный человеческий иммуноглобулин (ПСЧИ) — <strong>250 ME</strong>.
            </li>
            <li class="p-2 bg-amber-50 dark:bg-amber-900/10 rounded">
                <strong>Альтернатива:</strong> При отсутствии ПСЧИ вводят сыворотку противостолбнячную (ПСС) — <strong>3000 ME</strong>.
            </li>
          </ul>
        </section>

        <section>
          <h3>5. Препараты</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div class="border dark:border-slate-800 p-3 rounded">
                <h4 class="font-bold text-xs uppercase opacity-60">АС-анатоксин</h4>
                <p class="text-sm">Столбнячный анатоксин. Служит для создания/поддержания активного иммунитета.</p>
             </div>
             <div class="border dark:border-slate-800 p-3 rounded">
                <h4 class="font-bold text-xs uppercase opacity-60">ПСЧИ / ПСС</h4>
                <p class="text-sm">Готовые антитела для немедленной (пассивной) защиты.</p>
             </div>
          </div>
        </section>
      </div>
    `
  }
};