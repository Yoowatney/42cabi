const express = require("express");
const app = express();
const mariadb = require("mariadb");

require("dotenv").config();
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE,
});

let cabinetList = {
  location: [],
  floor: [],
  section: [],
  cabinet: [],
};

function sendResponse(res, data, status, code) {
  res.status(status).json({
    status: status,
    data: data,
    code: code,
  });
}

// 전체 사물함 정보
async function getCabinetInfo() {
  try {
    const connection = await pool.getConnection();

    const content1 = `SELECT DISTINCT cabinet.location from cabinet`;
    const result1 = await connection.query(content1);
    result1.forEach(async (element1) => {
      let floorList = [];
      let tmpSectionlist = [];
      let tmpCabinetList = [];

      cabinetList.location.push(element1.location);

      const content2 = `SELECT DISTINCT cabinet.floor FROM cabinet WHERE location='${element1.location}' order by floor`;
      const result2 = await connection.query(content2);
      result2.forEach(async (element2) => {
        let sectionList = [];
        cabinetList = [];

        floorList.push(element2.floor);

        const content3 = `SELECT DISTINCT cabinet.section FROM cabinet WHERE location='${element1.location}' and floor='${element2.floor}'`;
        const result3 = await connection.query(content3);
        result3.forEach(async (element3) => {
          let cabinet = [];
          sectionList.push(element3.section);

          // content4 쿼리에서 activation==1인 경우만 모아야 하나?
          const content4 = `SELECT * FROM cabinet WHERE location='${element1.location}' AND floor='${element2.floor}' AND section='${element3.section}' AND activation=1 order by cabinet_num`;
          const result4 = await connection.query(content4);
          result4.forEach(async (element4) => {
            cabinet.push(element4);
          });
          cabinetList.push(cabinet);
        });
        tmpSectionlist.push(sectionList);
        tmpCabinetList.push(cabinetList);
      });
      cabinetList.floor?.push(floorList);
      cabinetList.section?.push(tmpSectionlist);
      cabinetList.cabinet?.push(tmpCabinetList);
    });
    connection.release();
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function getLentUserInfo(res) {
  try {
    // TODO DB error가 주요 에러인데, 이 함수를 wrap함수로 묶어서 에러처리를 한번에 해야할지..
    let connection;
    let lentInfo = [];

    const content =
      "SELECT u.intra_id, l.* FROM user u RIGHT JOIN lent l ON l.lent_user_id=u.user_id";

    connection = await pool.getConnection();
    const lockerRentalUser = await connection.query(content);

    for (let i = 0; i < lockerRentalUser.length; i++) {
      lentInfo.push({
        lent_id: lockerRentalUser[i].lent_id,
        lent_cabinet_id: lockerRentalUser[i].lent_cabinet_id,
        lent_user_id: lockerRentalUser[i].lent_user_id,
        lent_time: lockerRentalUser[i].lent_time,
        expire_time: lockerRentalUser[i].expire_time,
        extension: lockerRentalUser[i].extension,
        intra_id: lockerRentalUser[i].intra_id,
      });
    }
    // pool.end();
    connection.release();
    console.log(lentInfo);
    return { lentInfo: lentInfo };
  } catch (err) {
    console.log(err);
    throw err;
    return sendResponse(res, {}, 400, "error");
  }
}

// 특정 사용자가 현재 대여하고 있는 사물함 + 유저 + 렌트 정보
async function getUserCabinetInfo(cabinetIdx) {
  try {
    let connection;
    connection = await pool.getConnection();

    const content = `SELECT * FROM lent l JOIN user u ON l.lent_user_id=u.user_id JOIN cabinet c ON c.cabinet_id=l.lent_cabinet_id WHERE c.cabinet_id=${cabinetIdx}`;
    const [userCabinetInfo] = await connection.query(content);

    // console.log("===========USERCABINETINFO============");
    // console.log(userCabinetInfo);
    connection.release();
    return { userCabinetInfo: userCabinetInfo };
  } catch (err) {
    console.log(err);
    throw err;
  }
}
// await pool
//   .query(content)
//   .then((res) => {
//     for (let i = 0; i < res.length; i++) {
//       lentInfo.push({
//         lent_id: res[i].lent_id,
//         lent_cabinet_id: res[i].lent_cabinet_id,
//         lent_user_id: res[i].lent_user_id,
//         lent_time: res[i].lent_time,
//         expire_time: res[i].expire_time,
//         extension: res[i].extension,
//         intra_id: res[i].intra_id,
//       });
//     }
//   })
//   .catch((err) => {
//     console.log(err);
//     throw err;
//   });
// if (pool) pool.end();
// return { lentInfo: lentInfo };

// 전체 사물함 정보
getCabinetInfo();

app.get("/api/cabinet", (_req, res) => {
  if (!cabinetList) {
    return sendResponse(res, {}, 400, "error");
    // res.status(400).json({ error: "No cabinet list" });
  } else {
    return sendResponse(res, cabinetList, 200, "ok");
    // res.send(cabinetList);
  }
});

app.get("/api/lent_info", async (req, res) => {
  const lentInfo = await getLentUserInfo(res);
  return sendResponse(res, lentInfo, 200, "ok");
  // return res.json(lentInfo);
  // return sendResponse(res, getLentUser(res), 200, "ok");
});

// app.get("/", async (req, res) => {
//   console.log("=========");
//   console.log(req.res.cookie);
//   console.log(res.cookie);
//   // await req.res.cookie("acc", 50);
//   return res.send("listen on 3000!");
// });

// 특정 사용자가 현재 대여하고 있는 사물함 + 유저 + 렌트 정보
app.get("/api/return_info", async (req, res) => {
  const { cabinetIdx } = req.query;
  if (!cabinetIdx) {
    return sendResponse(res, {}, 400, "req.query error");
  }
  const result = await getUserCabinetInfo(cabinetIdx);

  // console.log("========RESULT=========");
  // console.log(result);
  if (!result.userCabinetInfo) {
    return sendResponse(res, {}, 400, "error");
  }
  return sendResponse(res, result, 200, "ok");
});

app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
